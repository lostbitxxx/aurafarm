/** Chat copy above the desktop pet for distraction / close / open-bar idle. */

const CHAT_NO_SESSION = "Start a study session on our web!";
const CHAT_CLOSING = "That's enough!!!";
/** Soft nudge while a blocked site is up (after grace, before mad). */
const CHAT_NUDGE = [
  "Let's get back to it, human!",
  "*nudge* Focus!",
  "Psst… your study session misses you!",
  "*Poke* Time to focus!",
  "*Gentle paw you* Human!",
];
/** Last 5s before close — struggle face + firmer lines. */
const CHAT_MAD = [
  "FBI! Open the door!",
  "You are making me mad right now!",
  "I am stepping in!",
  "Stop playing around!",
  "Don't make me do this to you!",
];
const CHAT_FOCUSED = [
  "Auramaxxing...",
  "I'm studying with you...",
  "This looks hard...",
  "I can do this...",
  "Unstoppable...",
];
const CHAT_RECOVERED = [
  "Okay, back on track!",
  "Welcome back!",
  "Keep the flow going",
  "Let's keep on farming!",
  "You ready?",
];

/** Hostname for debug / site lines. Drops a leading www and a trailing .com. */
function chatSiteName(host) {
  return String(host ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "")
    .replace(/\.com$/, "");
}

/**
 * @param {{
 *   sessionActive?: boolean,
 *   closing?: boolean,
 *   onDistracted?: boolean,
 *   distractionPhase?: "none" | "warn" | "mad",
 *   everDistracted?: boolean,
 *   panelOpen?: boolean,
 *   host?: string,
 * }} input
 * @returns {{ lines: string[], scope: "none" | "pet" | "panel" | "peek" }}
 */
function chatBubbleLines(input = {}) {
  const sessionActive = Boolean(input.sessionActive);
  const closing = Boolean(input.closing);
  const onDistracted = Boolean(input.onDistracted);
  const everDistracted = Boolean(input.everDistracted);
  const panelOpen = Boolean(input.panelOpen);
  const phase = input.distractionPhase === "mad" || input.distractionPhase === "warn" ? input.distractionPhase : "none";

  if (!sessionActive) return { lines: [CHAT_NO_SESSION], scope: "pet" };
  if (closing) return { lines: [CHAT_CLOSING], scope: "pet" };
  if (onDistracted && phase !== "none") {
    const lines = phase === "mad" ? CHAT_MAD : CHAT_NUDGE;
    return { lines, scope: panelOpen ? "panel" : "peek" };
  }
  if (!panelOpen) return { lines: [], scope: "none" };
  if (!everDistracted) return { lines: CHAT_FOCUSED, scope: "panel" };
  return { lines: CHAT_RECOVERED, scope: "panel" };
}

/**
 * @param {{
 *   sessionActive?: boolean,
 *   closing?: boolean,
 *   onDistracted?: boolean,
 *   distractionPhase?: "none" | "warn" | "mad",
 *   everDistracted?: boolean,
 *   panelOpen?: boolean,
 *   host?: string,
 *   lineIndex?: number,
 * }} input
 * @returns {{ text: string, scope: "none" | "pet" | "panel" | "peek" }}
 *   pet = floating / no-session
 *   peek = closed-bar peek head
 *   panel = in-panel pet (open bar)
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

function shuffleLineOrder(count, random = Math.random) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const order = [];
  for (let i = 0; i < total; i += 1) order.push(i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = pickChatLineIndex(i + 1, random);
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  return order;
}

/**
 * Draw the next line without repeating until every line in the set has shown.
 * Refilling the bag will not start on `previous`.
 * @param {number[]} bag
 */
function takeShuffledLine(bag, count, previous = -1, random = Math.random) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  if (total <= 1) {
    bag.length = 0;
    return 0;
  }
  if (bag.length === 0) {
    const next = shuffleLineOrder(total, random);
    if (next[0] === previous && next.length > 1) {
      const swap = next[0];
      next[0] = next[1];
      next[1] = swap;
    }
    bag.push(...next);
  }
  return bag.shift();
}

module.exports = {
  CHAT_NO_SESSION,
  CHAT_CLOSING,
  CHAT_NUDGE,
  CHAT_MAD,
  CHAT_FOCUSED,
  CHAT_RECOVERED,
  chatSiteName,
  chatBubbleLines,
  chatBubbleCopy,
  pickChatLineIndex,
  shuffleLineOrder,
  takeShuffledLine,
};
