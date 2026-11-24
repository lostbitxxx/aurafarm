import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const {
  CHAT_NO_SESSION,
  CHAT_CLOSING,
  CHAT_DISTRACTED,
  CHAT_FOCUSED,
  CHAT_FOCUSED_GOOD,
  CHAT_RECOVERED,
  chatSiteName,
  chatBubbleCopy,
  pickChatLineIndex,
} = require("../desktop/chat-bubble.js") as {
  CHAT_NO_SESSION: string;
  CHAT_CLOSING: string;
  CHAT_DISTRACTED: string;
  CHAT_FOCUSED: string;
  CHAT_FOCUSED_GOOD: string;
  CHAT_RECOVERED: string;
  chatSiteName: (host?: string) => string;
  chatBubbleCopy: (input?: {
    sessionActive?: boolean;
    closing?: boolean;
    onDistracted?: boolean;
    everDistracted?: boolean;
    panelOpen?: boolean;
    host?: string;
    lineIndex?: number;
  }) => { text: string; scope: "none" | "pet" | "panel" };
  pickChatLineIndex: (count: number, random?: () => number) => number;
};

test("no study session prompts starting on the web", () => {
  assert.deepEqual(chatBubbleCopy({}), { text: CHAT_NO_SESSION, scope: "pet" });
  assert.deepEqual(chatBubbleCopy({ panelOpen: true, onDistracted: true }), {
    text: CHAT_NO_SESSION,
    scope: "pet",
  });
  assert.deepEqual(chatBubbleCopy({ closing: true }), { text: CHAT_NO_SESSION, scope: "pet" });
  assert.equal(CHAT_NO_SESSION, "Start a study session on our web!");
});

test("closing beats distraction and open-bar idle lines", () => {
  assert.deepEqual(
    chatBubbleCopy({
      sessionActive: true,
      closing: true,
      onDistracted: true,
      everDistracted: true,
      panelOpen: true,
    }),
    { text: CHAT_CLOSING, scope: "pet" },
  );
});

test("live distraction shows Lock in on the pet for open or closed bar", () => {
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, onDistracted: true, panelOpen: false }),
    { text: CHAT_DISTRACTED, scope: "pet" },
  );
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, onDistracted: true, panelOpen: true }),
    { text: CHAT_DISTRACTED, scope: "pet" },
  );
});

test("live distraction also asks why you are on that site", () => {
  assert.equal(chatSiteName("www.youtube.com"), "youtube.com");
  assert.deepEqual(
    chatBubbleCopy({
      sessionActive: true,
      onDistracted: true,
      host: "www.YouTube.com",
      lineIndex: 1,
    }),
    { text: "Why are you on youtube.com?", scope: "pet" },
  );
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, onDistracted: true, lineIndex: 1 }),
    { text: "this ain't the assignment", scope: "pet" },
  );
  assert.deepEqual(
    ["get off that lol", "we said lock in", "nahhh not this tab"].map((text, offset) =>
      chatBubbleCopy({ sessionActive: true, onDistracted: true, host: "youtube.com", lineIndex: offset + 3 }),
    ),
    ["get off that lol", "we said lock in", "nahhh not this tab"].map((text) => ({ text, scope: "pet" })),
  );
});

test("open-bar idle lines stay panel-only", () => {
  assert.deepEqual(chatBubbleCopy({ sessionActive: true, panelOpen: false }), { text: "", scope: "none" });
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, panelOpen: true, everDistracted: false }),
    { text: CHAT_FOCUSED, scope: "panel" },
  );
  assert.equal(CHAT_FOCUSED_GOOD, "You are doing so good!");
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, panelOpen: true, everDistracted: false, lineIndex: 1 }),
    { text: CHAT_FOCUSED_GOOD, scope: "panel" },
  );
  assert.deepEqual(
    ["locked in fr", "okayyy keep going", "don't fumble it"].map((text, offset) =>
      chatBubbleCopy({ sessionActive: true, panelOpen: true, everDistracted: false, lineIndex: offset + 2 }),
    ),
    ["locked in fr", "okayyy keep going", "don't fumble it"].map((text) => ({ text, scope: "panel" })),
  );
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, panelOpen: false, everDistracted: false, lineIndex: 1 }),
    { text: "", scope: "none" },
  );
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, panelOpen: true, everDistracted: true }),
    { text: CHAT_RECOVERED, scope: "panel" },
  );
  assert.deepEqual(
    ["okay we're back", "redemption arc", "slip happened. we move", "alright lock back in"].map(
      (text, offset) =>
        chatBubbleCopy({ sessionActive: true, panelOpen: true, everDistracted: true, lineIndex: offset + 1 }),
    ),
    ["okay we're back", "redemption arc", "slip happened. we move", "alright lock back in"].map((text) => ({
      text,
      scope: "panel",
    })),
  );
});

test("reopening the bar can start on any open-bar line", () => {
  assert.equal(pickChatLineIndex(5, () => 0), 0);
  assert.equal(pickChatLineIndex(5, () => 0.99), 4);
  assert.equal(pickChatLineIndex(1, () => 0.5), 0);
});

test("a new chat line expands out instead of swapping in place", () => {
  const { replayChatBubble } = require("../desktop/chat-motion.js") as {
    replayChatBubble: (node: {
      textContent: string;
      chatSeq?: number;
      offsetWidth: number;
      classList: { contains: (name: string) => boolean; add: (name: string) => void; remove: (name: string) => void };
    }, text: string, show: boolean) => void;
  };
  const frames: Array<() => void> = [];
  const previous = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((fn: () => void) => {
    frames.push(fn);
    return frames.length;
  }) as typeof requestAnimationFrame;
  const names = new Set(["is-on"]);
  const node = {
    textContent: "auramaxxing...",
    offsetWidth: 40,
    classList: {
      contains: (name: string) => names.has(name),
      add: (name: string) => {
        names.add(name);
      },
      remove: (name: string) => {
        names.delete(name);
      },
    },
  };
  try {
    replayChatBubble(node, "auramaxxing...", true);
    assert.equal(frames.length, 0);
    replayChatBubble(node, "locked in fr", true);
    assert.equal(node.textContent, "locked in fr");
    assert.equal(node.classList.contains("is-on"), false);
    assert.equal(node.classList.contains("is-instant"), true);
    frames.shift()?.();
    assert.equal(node.classList.contains("is-instant"), false);
    frames.shift()?.();
    assert.equal(node.classList.contains("is-on"), true);
  } finally {
    globalThis.requestAnimationFrame = previous;
  }
});
