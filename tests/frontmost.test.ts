import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { hostMatchesBlocklist } from "../lib/blocklist";

const require = createRequire(import.meta.url);
const {
  advanceFrontLog,
  CLOSE_AFTER_MS,
  createCloseWatch,
  createFrontLog,
  deskHostFromOrigin,
  hostMatchesBlocklist: petMatchesBlocklist,
  hostnameFromUrl,
  describeCloseDebug,
  describeFrontRead,
  nextCloseWatch,
  nextFrontLog,
  noteCloseAttempt,
  recordFrontHost,
} = require("../desktop/frontmost.js") as {
  CLOSE_AFTER_MS: number;
  advanceFrontLog: (
    log: {
      blockedCount: number;
      blockedHosts: string[];
      currentHost: string;
      distractionMs?: number;
      sampledAt?: number;
      onBlocklist?: boolean;
    },
    rawUrl: string,
    blocklist: readonly string[],
    deskHost: string,
    nowMs: number,
  ) => {
    blockedCount: number;
    blockedHosts: string[];
    currentHost: string;
    distractionMs: number;
    sampledAt: number;
    onBlocklist: boolean;
  };
  createCloseWatch: () => { host: string; since: number; attemptedHost: string; close: boolean };
  nextCloseWatch: (
    watch: { host: string; since: number; attemptedHost: string; close: boolean },
    input: {
      enabled: boolean;
      rawUrl: string;
      blocklist: readonly string[];
      deskHost: string;
      now: number;
    },
  ) => { host: string; since: number; attemptedHost: string; close: boolean };
  noteCloseAttempt: (watch: {
    host: string;
    since: number;
    attemptedHost: string;
    close: boolean;
  }) => { host: string; since: number; attemptedHost: string; close: boolean };
  createFrontLog: () => { blockedCount: number; blockedHosts: string[]; currentHost: string };
  deskHostFromOrigin: (origin: string) => string;
  hostMatchesBlocklist: (host: string, blockedHosts: readonly string[]) => boolean;
  hostnameFromUrl: (value: string) => string;
  describeCloseDebug: (input: {
    session?: boolean;
    closeBlocked?: boolean;
    preferenceError?: string;
    reading?: { app?: string; url?: string; error?: string };
    decision?: { host: string; since: number; close: boolean };
    now?: number;
    closeError?: string;
  }) => string;
  describeFrontRead: (
    reading: { app?: string; url?: string; error?: string },
    log: { blockedCount: number; blockedHosts: string[] },
  ) => string;
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
const { frontAppStatement, frontCloseStatement, frontUrlStatement, supportedFrontBrowser } =
  require("../desktop/front-browser.js") as {
    frontAppStatement: () => string;
    frontCloseStatement: (appName: string) => string;
    frontUrlStatement: (appName: string) => string;
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

test("time on a blocklist host adds up while that tab stays in front", () => {
  const start = 10_000;
  const seen = advanceFrontLog(
    createFrontLog(),
    "https://www.instagram.com/reels",
    blocked,
    desk,
    start,
  );
  assert.equal(seen.blockedCount, 1);
  assert.equal(seen.distractionMs, 0);
  assert.equal(seen.onBlocklist, true);

  const still = advanceFrontLog(seen, "https://www.instagram.com/explore", blocked, desk, start + 2_500);
  assert.equal(still.blockedCount, 1);
  assert.equal(still.distractionMs, 2_500);

  const away = advanceFrontLog(still, "https://example.com", blocked, desk, start + 4_000);
  assert.equal(away.blockedCount, 1);
  assert.equal(away.distractionMs, 2_500);
  assert.equal(away.onBlocklist, false);

  const deskVisit = advanceFrontLog(
    createFrontLog(),
    "http://localhost:3000/dashboard",
    ["localhost", ...blocked],
    desk,
    start,
  );
  const stillDesk = advanceFrontLog(
    deskVisit,
    "http://localhost:3000/study",
    ["localhost", ...blocked],
    desk,
    start + 5_000,
  );
  assert.equal(stillDesk.blockedCount, 0);
  assert.equal(stillDesk.distractionMs, 0);
  assert.equal(stillDesk.onBlocklist, false);
});

test("a missing browser url does not clear the current visit", () => {
  const seen = recordFrontHost(createFrontLog(), "https://www.youtube.com/watch?v=1", blocked, desk);
  const missed = recordFrontHost(seen, "", blocked, desk);
  assert.equal(missed, seen);
  const again = recordFrontHost(missed, "https://www.youtube.com/feed", blocked, desk);
  assert.equal(again.blockedCount, 1);
});

test("the mac reader asks only the front window of safari, chrome, or edge", () => {
  assert.equal(supportedFrontBrowser("Safari"), true);
  assert.equal(supportedFrontBrowser("Google Chrome"), true);
  assert.equal(supportedFrontBrowser("Microsoft Edge"), true);
  assert.equal(supportedFrontBrowser("Firefox"), false);
  assert.match(frontAppStatement(), /frontmost is true/);
  assert.match(frontUrlStatement("Safari"), /URL of current tab of front window/);
  assert.match(frontUrlStatement("Google Chrome"), /URL of active tab of front window/);
  assert.match(frontUrlStatement("Microsoft Edge"), /URL of active tab of front window/);
  assert.equal(frontUrlStatement("Firefox"), "");
  assert.doesNotMatch(frontUrlStatement("Google Chrome"), /every tab/);
  assert.match(frontCloseStatement("Safari"), /close current tab of front window/);
  assert.match(frontCloseStatement("Google Chrome"), /close active tab of front window/);
  assert.match(frontCloseStatement("Microsoft Edge"), /close active tab of front window/);
  assert.equal(frontCloseStatement("Firefox"), "");
  assert.doesNotMatch(frontCloseStatement("Google Chrome"), /close front window/);
});

test("a failed browser read is shown instead of a clear session", () => {
  const blockedRead = describeFrontRead(
    { error: "Not authorized to send Apple events to System Events. (-1743)" },
    createFrontLog(),
  );
  assert.match(blockedRead, /Allow Electron/);

  const otherApp = describeFrontRead({ app: "Electron", url: "", error: "" }, createFrontLog());
  assert.match(otherApp, /Electron is in front/);

  const youtube = recordFrontHost(createFrontLog(), "https://www.youtube.com/", blocked, desk);
  assert.equal(
    describeFrontRead({ app: "Google Chrome", url: "https://www.youtube.com/", error: "" }, youtube),
    "Watching. Blocked 1: www.youtube.com",
  );
});

function dwell(watch: ReturnType<typeof createCloseWatch>, rawUrl: string, now: number, enabled = true) {
  return nextCloseWatch(watch, {
    enabled,
    rawUrl,
    blocklist: blocked,
    deskHost: desk,
    now,
  });
}

test("a blocked host is closed once after 60 seconds on that page", () => {
  assert.equal(CLOSE_AFTER_MS, 60_000);
  const start = 1_000;
  const seen = dwell(createCloseWatch(), "https://www.instagram.com/reels", start);
  assert.equal(seen.close, false);
  assert.equal(seen.since, start);

  const still = dwell(seen, "https://www.instagram.com/explore", start + 59_999);
  assert.equal(still.close, false);
  assert.equal(still.since, start);

  const due = dwell(still, "https://www.instagram.com/", start + 60_000);
  assert.equal(due.close, true);
  assert.equal(due.host, "www.instagram.com");

  const counted = recordFrontHost(createFrontLog(), "https://www.instagram.com/reels", blocked, desk);
  assert.equal(counted.blockedCount, 1);

  const attempted = noteCloseAttempt(due);
  const again = dwell(attempted, "https://www.instagram.com/reels", start + 80_000);
  assert.equal(again.close, false);
  assert.equal(again.since, start);
});

test("leaving, a lookalike, the desk, or switching the toggle off clears the wait", () => {
  const start = 5_000;
  const seen = dwell(createCloseWatch(), "https://www.instagram.com/", start);
  const away = dwell(seen, "https://example.com", start + 4_000);
  assert.equal(away.close, false);
  assert.equal(away.host, "");

  const back = dwell(away, "https://www.instagram.com/", start + 4_500);
  assert.equal(back.since, start + 4_500);
  assert.equal(back.close, false);

  const lookalike = dwell(seen, "https://notinstagram.com", start + 9_000);
  assert.equal(lookalike.host, "");
  assert.equal(lookalike.close, false);

  const deskVisit = nextCloseWatch(seen, {
    enabled: true,
    rawUrl: "http://localhost:3000/dashboard",
    blocklist: ["localhost", ...blocked],
    deskHost: desk,
    now: start + 9_000,
  });
  assert.equal(deskVisit.close, false);
  assert.equal(deskVisit.host, "");

  const disabled = dwell(seen, "https://www.instagram.com/", start + 9_000, false);
  assert.equal(disabled.close, false);
  assert.equal(disabled.host, "");
});

test("a different blocked host starts a new 60 second wait", () => {
  const instagram = dwell(createCloseWatch(), "https://www.instagram.com/", 1_000);
  const youtube = dwell(instagram, "https://www.youtube.com/feed", 61_000);
  assert.equal(youtube.host, "www.youtube.com");
  assert.equal(youtube.since, 61_000);
  assert.equal(youtube.close, false);
  assert.equal(dwell(youtube, "https://www.youtube.com/feed", 121_000).close, true);
});

test("a missing address does not reset the wait or close on its own", () => {
  const seen = dwell(createCloseWatch(), "https://www.tiktok.com/", 2_000);
  const missed = dwell(seen, "", 70_000);
  assert.equal(missed.host, "www.tiktok.com");
  assert.equal(missed.since, 2_000);
  assert.equal(missed.close, false);
  assert.equal(dwell(missed, "https://www.tiktok.com/@farm", 62_000).close, true);
});

test("the debug line names the reason a blocked tab stays open", () => {
  assert.match(describeCloseDebug({ session: false }), /no study session/);
  assert.match(
    describeCloseDebug({
      session: true,
      closeBlocked: false,
      reading: { app: "Google Chrome", url: "https://www.youtube.com/watch?v=1" },
    }),
    /Close blocked tabs is off/,
  );
  assert.match(
    describeCloseDebug({
      session: true,
      closeBlocked: true,
      reading: { app: "Google Chrome", url: "https://www.youtube.com/watch?v=1" },
      decision: { host: "www.youtube.com", since: 1_000, close: false },
      now: 4_000,
    }),
    /www.youtube.com in Google Chrome for 3s of 60s/,
  );
  assert.match(
    describeCloseDebug({
      session: true,
      closeBlocked: true,
      reading: { app: "Google Chrome", error: "Not authorized to send Apple events. (-1743)" },
    }),
    /-1743/,
  );
});
