import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { hostMatchesBlocklist } from "../lib/blocklist";

const require = createRequire(import.meta.url);
const {
  createFrontLog,
  deskHostFromOrigin,
  hostMatchesBlocklist: petMatchesBlocklist,
  hostnameFromUrl,
  nextFrontLog,
  recordFrontHost,
} = require("../desktop/frontmost.js") as {
  createFrontLog: () => { blockedCount: number; blockedHosts: string[]; currentHost: string };
  deskHostFromOrigin: (origin: string) => string;
  hostMatchesBlocklist: (host: string, blockedHosts: readonly string[]) => boolean;
  hostnameFromUrl: (value: string) => string;
  nextFrontLog: (
    active: boolean,
    log: { blockedCount: number; blockedHosts: string[]; currentHost: string },
    rawUrl: string,
    blocklist: readonly string[],
    deskHost: string,
  ) => { blockedCount: number; blockedHosts: string[]; currentHost: string };
  recordFrontHost: (
    log: { blockedCount: number; blockedHosts: string[]; currentHost: string },
    rawUrl: string,
    blocklist: readonly string[],
    deskHost: string,
    matches?: (host: string, blockedHosts: readonly string[]) => boolean,
  ) => { blockedCount: number; blockedHosts: string[]; currentHost: string };
};
const { frontBrowserScript, supportedFrontBrowser } = require("../desktop/front-browser.js") as {
  frontBrowserScript: () => string;
  supportedFrontBrowser: (appName: string) => boolean;
};

const blocked = ["instagram.com", "tiktok.com", "youtube.com"];
const desk = "localhost";

test("the pet host rule matches the server blocklist", () => {
  const samples = [
    "instagram.com",
    "WWW.Instagram.com",
    "www.instagram.com",
    "m.youtube.com",
    "notinstagram.com",
    "instagram.com.evil.com",
    "https://instagram.com",
    "localhost",
  ];
  for (const host of samples) {
    assert.equal(petMatchesBlocklist(host, blocked), hostMatchesBlocklist(host, blocked), host);
  }
});

test("a front instagram tab counts once until the host changes away", () => {
  const first = recordFrontHost(
    createFrontLog(),
    "https://www.instagram.com/reels",
    blocked,
    desk,
    hostMatchesBlocklist,
  );
  assert.equal(first.blockedCount, 1);
  assert.deepEqual(first.blockedHosts, ["www.instagram.com"]);

  const still = recordFrontHost(first, "https://www.instagram.com/explore", blocked, desk);
  assert.equal(still.blockedCount, 1);
  assert.equal(still, first);

  const away = recordFrontHost(still, "https://example.com", blocked, desk);
  assert.equal(away.blockedCount, 1);
  assert.deepEqual(away.blockedHosts, ["www.instagram.com"]);

  const back = recordFrontHost(away, "https://www.instagram.com/", blocked, desk);
  assert.equal(back.blockedCount, 2);
  assert.deepEqual(back.blockedHosts, ["www.instagram.com"]);
});

test("the aurafarm desk and a lookalike host do not count", () => {
  assert.equal(hostnameFromUrl("http://localhost:3000/dashboard"), "localhost");
  assert.equal(deskHostFromOrigin("http://localhost:3000"), "localhost");

  const deskVisit = recordFrontHost(
    createFrontLog(),
    "http://localhost:3000/dashboard",
    ["localhost", ...blocked],
    desk,
  );
  assert.equal(deskVisit.blockedCount, 0);
  assert.deepEqual(deskVisit.blockedHosts, []);

  const lookalike = recordFrontHost(
    createFrontLog(),
    "https://notinstagram.com",
    blocked,
    desk,
  );
  assert.equal(lookalike.blockedCount, 0);
  assert.deepEqual(lookalike.blockedHosts, []);
});

test("an idle pet does not apply a front url, including after the session ends", () => {
  const seen = recordFrontHost(createFrontLog(), "https://www.instagram.com", blocked, desk);
  const idle = nextFrontLog(false, createFrontLog(), "https://www.instagram.com", blocked, desk);
  assert.equal(idle.blockedCount, 0);
  assert.deepEqual(idle.blockedHosts, []);

  const ended = nextFrontLog(false, seen, "https://www.instagram.com/reels", blocked, desk);
  assert.equal(ended, seen);
  assert.equal(ended.blockedCount, 1);
});

test("a missing browser url does not clear the current visit", () => {
  const seen = recordFrontHost(createFrontLog(), "https://www.youtube.com/watch?v=1", blocked, desk);
  const missed = recordFrontHost(seen, "", blocked, desk);
  assert.equal(missed, seen);
  const again = recordFrontHost(missed, "https://www.youtube.com/feed", blocked, desk);
  assert.equal(again.blockedCount, 1);
});

test("the mac reader asks only the front window of safari, chrome, or edge", () => {
  const script = frontBrowserScript();
  assert.equal(supportedFrontBrowser("Safari"), true);
  assert.equal(supportedFrontBrowser("Google Chrome"), true);
  assert.equal(supportedFrontBrowser("Microsoft Edge"), true);
  assert.equal(supportedFrontBrowser("Firefox"), false);
  assert.match(script, /URL of current tab of front window/);
  assert.match(script, /URL of active tab of front window/);
  assert.match(script, /frontApp is "Safari"/);
  assert.match(script, /frontApp is "Google Chrome"/);
  assert.match(script, /frontApp is "Microsoft Edge"/);
  assert.doesNotMatch(script, /every tab/);
  assert.doesNotMatch(script, /Firefox/);
});
