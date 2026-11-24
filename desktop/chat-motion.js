/** Replay the bubble so a new line expands out from the tip instead of popping. */

function replayChatBubble(node, text, show) {
  if (!node) return;
  const next = show ? text : "";
  const on = node.classList.contains("is-on");
  if (node.textContent === next && on === Boolean(next)) return;
  const seq = (node.chatSeq = (node.chatSeq || 0) + 1);
  node.classList.add("is-instant");
  node.classList.remove("is-on");
  node.textContent = next;
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
  module.exports = { replayChatBubble };
}
