import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const {
  CHAT_NO_SESSION,
  CHAT_CLOSING,
  CHAT_NUDGE,
  CHAT_MAD,
  CHAT_FOCUSED,
  CHAT_RECOVERED,
  CHAT_BREAK,
  chatSiteName,
  chatBubbleCopy,
  pickChatLineIndex,
  takeShuffledLine,
} = require("../desktop/chat-bubble.js") as {
  CHAT_NO_SESSION: string;
  CHAT_CLOSING: string;
  CHAT_NUDGE: string[];
  CHAT_MAD: string[];
  CHAT_FOCUSED: string[];
  CHAT_RECOVERED: string[];
  CHAT_BREAK: string[];
  chatSiteName: (host?: string) => string;
  chatBubbleCopy: (input?: {
    sessionActive?: boolean;
    closing?: boolean;
    timeUp?: boolean;
    onDistracted?: boolean;
    distractionPhase?: "none" | "warn" | "mad";
    everDistracted?: boolean;
    panelOpen?: boolean;
    host?: string;
    lineIndex?: number;
  }) => { text: string; scope: "none" | "pet" | "panel" | "peek" };
  pickChatLineIndex: (count: number, random?: () => number) => number;
  takeShuffledLine: (bag: number[], count: number, previous?: number, random?: () => number) => number;
};

test("no study session prompts starting on the web", () => {
  assert.deepEqual(chatBubbleCopy({}), { text: CHAT_NO_SESSION, scope: "pet" });
  assert.deepEqual(chatBubbleCopy({ panelOpen: true, onDistracted: true, distractionPhase: "warn" }), {
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
      distractionPhase: "mad",
      everDistracted: true,
      panelOpen: true,
    }),
    { text: CHAT_CLOSING, scope: "pet" },
  );
});

test("time-up break lines show on closed peek and open panel", () => {
  assert.deepEqual(CHAT_BREAK, [
    "Break time!",
    "Times up!",
    "Take a short break!",
    "Stay hydrated!",
    "Take a sip of water!",
  ]);
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, timeUp: true, panelOpen: false }),
    { text: CHAT_BREAK[0], scope: "peek" },
  );
  assert.deepEqual(
    chatBubbleCopy({
      sessionActive: true,
      timeUp: true,
      panelOpen: false,
      onDistracted: true,
      distractionPhase: "mad",
      lineIndex: 2,
    }),
    { text: CHAT_BREAK[2], scope: "peek" },
  );
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, timeUp: true, panelOpen: true, everDistracted: false }),
    { text: CHAT_BREAK[0], scope: "panel" },
  );
  assert.deepEqual(
    chatBubbleCopy({
      sessionActive: true,
      timeUp: true,
      panelOpen: true,
      everDistracted: true,
      lineIndex: 3,
    }),
    { text: CHAT_BREAK[3], scope: "panel" },
  );
});

test("grace phase before peek keeps chat empty while distracted", () => {
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, onDistracted: true, distractionPhase: "none", panelOpen: false }),
    { text: "", scope: "none" },
  );
});

test("nudge lines show on closed-bar peek after grace", () => {
  assert.equal(CHAT_NUDGE[0], "Let's get back to it, human!");
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, onDistracted: true, distractionPhase: "warn", panelOpen: false }),
    { text: CHAT_NUDGE[0], scope: "peek" },
  );
  assert.deepEqual(
    chatBubbleCopy({
      sessionActive: true,
      onDistracted: true,
      distractionPhase: "warn",
      panelOpen: false,
      lineIndex: 1,
    }),
    { text: CHAT_NUDGE[1], scope: "peek" },
  );
});

test("nudge lines show on the open-bar panel pet", () => {
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, onDistracted: true, distractionPhase: "warn", panelOpen: true }),
    { text: CHAT_NUDGE[0], scope: "panel" },
  );
});

test("mad lines replace nudge in the last seconds", () => {
  assert.equal(CHAT_MAD[0], "FBI! Open the door!");
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, onDistracted: true, distractionPhase: "mad", panelOpen: false }),
    { text: CHAT_MAD[0], scope: "peek" },
  );
  assert.deepEqual(
    chatBubbleCopy({
      sessionActive: true,
      onDistracted: true,
      distractionPhase: "mad",
      panelOpen: true,
      lineIndex: 4,
    }),
    { text: CHAT_MAD[4], scope: "panel" },
  );
});

test("site name helper still strips www and .com", () => {
  assert.equal(chatSiteName("www.youtube.com"), "youtube");
});

test("open-bar idle lines stay panel-only", () => {
  assert.deepEqual(chatBubbleCopy({ sessionActive: true, panelOpen: false }), { text: "", scope: "none" });
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, panelOpen: true, everDistracted: false }),
    { text: CHAT_FOCUSED[0], scope: "panel" },
  );
  assert.deepEqual(CHAT_FOCUSED, [
    "Auramaxxing...",
    "I'm studying with you...",
    "This looks hard...",
    "I can do this...",
    "Unstoppable...",
  ]);
  assert.deepEqual(
    CHAT_FOCUSED.map((text, index) =>
      chatBubbleCopy({ sessionActive: true, panelOpen: true, everDistracted: false, lineIndex: index }),
    ),
    CHAT_FOCUSED.map((text) => ({ text, scope: "panel" })),
  );
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, panelOpen: false, everDistracted: false, lineIndex: 1 }),
    { text: "", scope: "none" },
  );
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, panelOpen: true, everDistracted: true }),
    { text: CHAT_RECOVERED[0], scope: "panel" },
  );
  assert.deepEqual(CHAT_RECOVERED, [
    "Okay, back on track!",
    "Welcome back!",
    "Keep the flow going",
    "Let's keep on farming!",
    "You ready?",
  ]);
  assert.deepEqual(
    CHAT_RECOVERED.map((text, index) =>
      chatBubbleCopy({ sessionActive: true, panelOpen: true, everDistracted: true, lineIndex: index }),
    ),
    CHAT_RECOVERED.map((text) => ({ text, scope: "panel" })),
  );
});

test("reopening the bar can start on any open-bar line", () => {
  assert.equal(pickChatLineIndex(5, () => 0), 0);
  assert.equal(pickChatLineIndex(5, () => 0.99), 4);
  assert.equal(pickChatLineIndex(1, () => 0.5), 0);
});

test("a line set is shuffled without repeating until every line has shown", () => {
  const bag: number[] = [];
  const seen: number[] = [];
  const count = CHAT_FOCUSED.length + CHAT_RECOVERED.length;
  for (let i = 0; i < count * 2; i += 1) {
    seen.push(takeShuffledLine(bag, count, seen.at(-1) ?? -1, () => 0));
  }
  assert.equal(new Set(seen.slice(0, 10)).size, 10);
  assert.equal(new Set(seen.slice(10)).size, 10);
  assert.notEqual(seen[10], seen[9]);
});

test("a new chat line expands out instead of swapping in place", () => {
  const { formatChatHtml, replayChatBubble } = require("../desktop/chat-motion.js") as {
    formatChatHtml: (text: string) => string;
    replayChatBubble: (
      node: {
        textContent: string;
        innerHTML: string;
        dataset?: { chatText?: string };
        chatSeq?: number;
        offsetWidth: number;
        classList: { contains: (name: string) => boolean; add: (name: string) => void; remove: (name: string) => void };
      },
      text: string,
      show: boolean,
    ) => void;
  };
  assert.equal(formatChatHtml("*touch*"), "<strong>*touch*</strong>");
  assert.equal(formatChatHtml("*nudge* Focus!"), "<strong>*nudge*</strong> Focus!");
  const frames: Array<() => void> = [];
  const previous = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((fn: () => void) => {
    frames.push(fn);
    return frames.length;
  }) as typeof requestAnimationFrame;
  const names = new Set(["is-on"]);
  const node = {
    textContent: "Auramaxxing...",
    innerHTML: "Auramaxxing...",
    dataset: { chatText: "Auramaxxing..." },
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
    replayChatBubble(node, "Auramaxxing...", true);
    assert.equal(frames.length, 0);
    replayChatBubble(node, "I'm studying with you...", true);
    assert.equal(node.dataset.chatText, "I'm studying with you...");
    assert.equal(node.innerHTML, "I'm studying with you...");
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
