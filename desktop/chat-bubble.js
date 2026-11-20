/** Chat copy above the desktop pet for distraction / close / open-bar idle. */

const CHAT_NO_SESSION = "Start a study session on our web!";
const CHAT_CLOSING = "That's enough!!!";
const CHAT_DISTRACTED = "Lock in bro >:(";
const CHAT_FOCUSED = "auramaxxing...";
const CHAT_RECOVERED = "Badly done is still better than not started.";

/**
 * @param {{
 *   sessionActive?: boolean,
 *   closing?: boolean,
 *   onDistracted?: boolean,
 *   everDistracted?: boolean,
 *   panelOpen?: boolean,
 * }} input
 * @returns {{ text: string, scope: "none" | "pet" | "panel" }}
 *   pet = show on external pet and in-panel pet
 *   panel = in-panel pet only (open bar)
 */
function chatBubbleCopy(input = {}) {
  const sessionActive = Boolean(input.sessionActive);
  const closing = Boolean(input.closing);
  const onDistracted = Boolean(input.onDistracted);
  const everDistracted = Boolean(input.everDistracted);
  const panelOpen = Boolean(input.panelOpen);

  if (!sessionActive) return { text: CHAT_NO_SESSION, scope: "pet" };
  if (closing) return { text: CHAT_CLOSING, scope: "pet" };
  if (onDistracted) return { text: CHAT_DISTRACTED, scope: "pet" };
  if (!panelOpen) return { text: "", scope: "none" };
  if (!everDistracted) return { text: CHAT_FOCUSED, scope: "panel" };
  return { text: CHAT_RECOVERED, scope: "panel" };
}

module.exports = {
  CHAT_NO_SESSION,
  CHAT_CLOSING,
  CHAT_DISTRACTED,
  CHAT_FOCUSED,
  CHAT_RECOVERED,
  chatBubbleCopy,
};
