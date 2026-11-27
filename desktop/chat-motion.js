/** Replay the bubble so a new line expands out from the tip instead of popping. */

/**
 * Escape HTML, then wrap *segment* as bold while keeping the asterisks visible.
 * Example: `*touch*` → `<strong>*touch*</strong>`
 */
function formatChatHtml(text) {
  const raw = String(text ?? "");
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped.replace(/\*([^*]+)\*/g, "<strong>*$1*</strong>");
}

function replayChatBubble(node, text, show) {
  if (!node) return;
  const next = show ? String(text ?? "") : "";
  const on = node.classList.contains("is-on");
  const prev = typeof node.dataset?.chatText === "string" ? node.dataset.chatText : node.textContent || "";
  if (prev === next && on === Boolean(next)) return;
  const seq = (node.chatSeq = (node.chatSeq || 0) + 1);
  node.classList.add("is-instant");
  node.classList.remove("is-on");
  if (node.dataset) node.dataset.chatText = next;
  if (next) node.innerHTML = formatChatHtml(next);
  else node.textContent = "";
  if (!next) {
    node.classList.remove("is-instant");
    return;
  }
  requestAnimationFrame(() => {
    if (node.chatSeq !== seq) return;
    node.classList.remove("is-instant");
    void node.offsetWidth;
    requestAnimationFrame(() => {
      if (node.chatSeq !== seq) return;
      node.classList.add("is-on");
    });
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { formatChatHtml, replayChatBubble };
}
