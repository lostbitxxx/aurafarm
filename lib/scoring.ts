import { createHash, randomBytes } from "node:crypto";

export const FOCUSED_SCORE = 100;
export const DISTRACTED_SCORE = 40;

const LAUNCH_CODE_ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ23456789";

export function scoreForBlockedCount(blockedCount: number) {
  return blockedCount > 0 ? DISTRACTED_SCORE : FOCUSED_SCORE;
}

export function createSessionSecret() {
  return randomBytes(32).toString("base64url");
}

export function createLaunchCode() {
  const bytes = randomBytes(10);
  let code = "";
  for (const byte of bytes) {
    code += LAUNCH_CODE_ALPHABET[byte % LAUNCH_CODE_ALPHABET.length];
  }
  return code;
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
