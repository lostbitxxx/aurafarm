/**
 * Godot 4 web exports use SharedArrayBuffer. Browsers only enable it when the
 * document is cross-origin isolated, which requires both of these headers on
 * the dev server and on production responses.
 */
export const crossOriginIsolationHeaders = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
] as const;

export function applyCrossOriginIsolation(response: {
  headers: { set: (key: string, value: string) => void };
}) {
  for (const header of crossOriginIsolationHeaders) {
    response.headers.set(header.key, header.value);
  }
  return response;
}
