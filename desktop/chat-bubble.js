/** Chat copy above the desktop pet for distraction / close / open-bar idle. */

const CHAT_NO_SESSION = "Start a study session on our web!";
const CHAT_CLOSING = "That's enough!!!";
const CHAT_DISTRACTED = "Lock in bro >:(";
const CHAT_DISTRACTED_EXTRA = [
  "this ain't the assignment",
  "get off that lol",
  "we said lock in",
  "nahhh not this tab",
];
const CHAT_FOCUSED = "auramaxxing...";
const CHAT_FOCUSED_GOOD = "You are doing so good!";
const CHAT_FOCUSED_EXTRA = ["locked in fr", "okayyy keep going", "don't fumble it"];
const CHAT_RECOVERED = "Badly done is still better than not started.";
const CHAT_RECOVERED_EXTRA = [
  "okay we're back",
  "redemption arc",
  "slip happened. we move",
  "alright lock back in",
];

/** Hostname for the distraction line. Drops a leading www and a trailing .com. */
function chatSiteName(host) {
  return String(host ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "")
    .replace(/\.com$/, "");
}

function chatDistractedOnSite(host) {
  const site = chatSiteName(host);
  return site ? `Why are you on ${site}?` : "";
}

/**
 * @param {{
 *   sessionActive?: boolean,
 *   closing?: boolean,
 *   onDistracted?: boolean,
 *   everDistracted?: boolean,
 *   panelOpen?: boolean,
 *   host?: string,
 * }} input
 * @returns {{ lines: string[], scope: "none" | "pet" | "panel" }}
 */
function chatBubbleLines(input = {}) {
  const sessionActive = Boolean(input.sessionActive);
  const closing = Boolean(input.closing);
  const onDistracted = Boolean(input.onDistracted);
  const everDistracted = Boolean(input.everDistracted);
  const panelOpen = Boolean(input.panelOpen);

  if (!sessionActive) return { lines: [CHAT_NO_SESSION], scope: "pet" };
  if (closing) return { lines: [CHAT_CLOSING], scope: "pet" };
  if (onDistracted) {
    const onSite = chatDistractedOnSite(input.host);
    return {
      lines: onSite ? [CHAT_DISTRACTED, onSite, ...CHAT_DISTRACTED_EXTRA] : [CHAT_DISTRACTED, ...CHAT_DISTRACTED_EXTRA],
      scope: "pet",
    };
  }
  if (!panelOpen) return { lines: [], scope: "none" };
  if (!everDistracted) return { lines: [CHAT_FOCUSED, CHAT_FOCUSED_GOOD, ...CHAT_FOCUSED_EXTRA], scope: "panel" };
  return { lines: [CHAT_RECOVERED, ...CHAT_RECOVERED_EXTRA], scope: "panel" };
}

/**
 * @param {{
 *   sessionActive?: boolean,
 *   closing?: boolean,
 *   onDistracted?: boolean,
 *   everDistracted?: boolean,
 *   panelOpen?: boolean,
 *   host?: string,
 *   lineIndex?: number,
 * }} input
 * @returns {{ text: string, scope: "none" | "pet" | "panel" }}
 *   pet = show on external pet and in-panel pet
 *   panel = in-panel pet only (open bar)
 */
function chatBubbleCopy(input = {}) {
  const { lines, scope } = chatBubbleLines(input);
  if (!lines.length) return { text: "", scope };
  const raw = Number(input.lineIndex);
  const index = Number.isInteger(raw) && raw >= 0 ? raw % lines.length : 0;
  return { text: lines[index], scope };
}

/** Random index when the bar opens, so it does not always start on the first line. */
function pickChatLineIndex(count, random = Math.random) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  if (total <= 1) return 0;
  const roll = Number(random());
  const unit = Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 0.999999) : 0;
  return Math.floor(unit * total);
}

module.exports = {
  CHAT_NO_SESSION,
  CHAT_CLOSING,
  CHAT_DISTRACTED,
  CHAT_FOCUSED,
  CHAT_FOCUSED_GOOD,
  CHAT_RECOVERED,
  chatSiteName,
  chatBubbleLines,
  chatBubbleCopy,
  pickChatLineIndex,
};
