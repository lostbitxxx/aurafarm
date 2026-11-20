import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const {
  CHAT_CLOSING,
  CHAT_DISTRACTED,
  CHAT_FOCUSED,
  CHAT_RECOVERED,
  chatBubbleCopy,
} = require("../desktop/chat-bubble.js") as {
  CHAT_CLOSING: string;
  CHAT_DISTRACTED: string;
  CHAT_FOCUSED: string;
  CHAT_RECOVERED: string;
  chatBubbleCopy: (input?: {
    sessionActive?: boolean;
    closing?: boolean;
    onDistracted?: boolean;
    everDistracted?: boolean;
    panelOpen?: boolean;
  }) => { text: string; scope: "none" | "pet" | "panel" };
};

test("chat bubbles stay empty without an active study session", () => {
  assert.deepEqual(chatBubbleCopy({ panelOpen: true, onDistracted: true }), { text: "", scope: "none" });
  assert.deepEqual(chatBubbleCopy({ closing: true }), { text: "", scope: "none" });
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

test("open-bar idle lines stay panel-only", () => {
  assert.deepEqual(chatBubbleCopy({ sessionActive: true, panelOpen: false }), { text: "", scope: "none" });
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, panelOpen: true, everDistracted: false }),
    { text: CHAT_FOCUSED, scope: "panel" },
  );
  assert.deepEqual(
    chatBubbleCopy({ sessionActive: true, panelOpen: true, everDistracted: true }),
    { text: CHAT_RECOVERED, scope: "panel" },
  );
});
