export const RENAME_COUPON_ID = "rename_coupon";
export const RENAME_COUPON_MAX = 3;
export const RENAME_COUPON_NAME = "Rename coupon";
export const RENAME_COUPON_ICON = "/pet-assets/accessories/rename-coupon.svg";
export const RENAME_PET_NAME_MAX = 16;

export function clampRenameCoupons(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(RENAME_COUPON_MAX, Math.trunc(n)));
}

export function normalizePetName(value: string) {
  return value.trim();
}

export function petNameError(value: string) {
  const trimmed = normalizePetName(value);
  if (trimmed.length < 1 || trimmed.length > RENAME_PET_NAME_MAX) {
    return `Pick a name between 1 and ${RENAME_PET_NAME_MAX} characters.`;
  }
  return "";
}
