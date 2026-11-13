export const REWARD_SHUFFLE_LIMIT = 3;

export type RewardPools = {
  colors: readonly string[];
  hats: readonly string[];
  clothes: readonly string[];
};

export type RewardOffer = {
  colorId: string | null;
  hatId: string | null;
  clothesId: string | null;
  shufflesUsed: number;
};

function pickOne(ids: readonly string[], random: () => number, current: string | null) {
  if (ids.length === 0) return null;
  const alternatives = current ? ids.filter((id) => id !== current) : [...ids];
  const pool = alternatives.length > 0 ? alternatives : ids;
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
  return pool[index] ?? null;
}

function clampShuffles(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= REWARD_SHUFFLE_LIMIT
    ? value
    : 0;
}

export function drawRewardOffer(pools: RewardPools, random: () => number = Math.random, shufflesUsed = 0): RewardOffer {
  return {
    colorId: pickOne(pools.colors, random, null),
    hatId: pickOne(pools.hats, random, null),
    clothesId: pickOne(pools.clothes, random, null),
    shufflesUsed: clampShuffles(shufflesUsed),
  };
}

export function canShuffleReward(offer: RewardOffer, pools: RewardPools) {
  if (offer.shufflesUsed >= REWARD_SHUFFLE_LIMIT) return false;
  return pools.colors.length > 1 || pools.hats.length > 1 || pools.clothes.length > 1;
}

export function shuffleRewardOffer(
  current: RewardOffer,
  pools: RewardPools,
  random: () => number = Math.random,
): RewardOffer | null {
  if (!canShuffleReward(current, pools)) return null;
  return {
    colorId: pickOne(pools.colors, random, current.colorId),
    hatId: pickOne(pools.hats, random, current.hatId),
    clothesId: pickOne(pools.clothes, random, current.clothesId),
    shufflesUsed: current.shufflesUsed + 1,
  };
}

export function restoreRewardOffer(
  stored: RewardOffer | null,
  pools: RewardPools,
  random: () => number = Math.random,
): RewardOffer {
  if (!stored) return drawRewardOffer(pools, random, 0);
  return {
    colorId: stored.colorId && pools.colors.includes(stored.colorId) ? stored.colorId : pickOne(pools.colors, random, null),
    hatId: stored.hatId && pools.hats.includes(stored.hatId) ? stored.hatId : pickOne(pools.hats, random, null),
    clothesId:
      stored.clothesId && pools.clothes.includes(stored.clothesId) ? stored.clothesId : pickOne(pools.clothes, random, null),
    shufflesUsed: clampShuffles(stored.shufflesUsed),
  };
}

const offerListeners = new Set<() => void>();
let offerCache: { key: string; offer: RewardOffer } | null = null;

function offerStorageKey(userId: string, rewardId: string) {
  return `aurafarm.level-reward.offer.${userId}.${rewardId}`;
}

function offerCacheKey(userId: string, rewardId: string, pools: RewardPools) {
  return `${userId}:${rewardId}:${pools.colors.join(",")}|${pools.hats.join(",")}|${pools.clothes.join(",")}`;
}

export function subscribeRewardOffers(listener: () => void) {
  offerListeners.add(listener);
  return () => {
    offerListeners.delete(listener);
  };
}

export function rewardOfferSnapshot(userId: string, rewardId: string, pools: RewardPools): RewardOffer {
  const key = offerCacheKey(userId, rewardId, pools);
  if (offerCache?.key === key) return offerCache.offer;
  const offer = restoreRewardOffer(readRewardOffer(userId, rewardId), pools);
  writeRewardOffer(userId, rewardId, offer);
  offerCache = { key, offer };
  return offer;
}

export function rewardOfferServerSnapshot(): RewardOffer | null {
  return null;
}

export function saveRewardOffer(userId: string, rewardId: string, pools: RewardPools, offer: RewardOffer) {
  writeRewardOffer(userId, rewardId, offer);
  offerCache = { key: offerCacheKey(userId, rewardId, pools), offer };
  for (const listener of offerListeners) listener();
}

export function readRewardOffer(userId: string, rewardId: string): RewardOffer | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(offerStorageKey(userId, rewardId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RewardOffer>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      colorId: typeof parsed.colorId === "string" ? parsed.colorId : null,
      hatId: typeof parsed.hatId === "string" ? parsed.hatId : null,
      clothesId: typeof parsed.clothesId === "string" ? parsed.clothesId : null,
      shufflesUsed: clampShuffles(parsed.shufflesUsed),
    };
  } catch {
    return null;
  }
}

export function writeRewardOffer(userId: string, rewardId: string, offer: RewardOffer) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(offerStorageKey(userId, rewardId), JSON.stringify(offer));
}

export function forgetRewardOffer(userId: string, rewardId: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(offerStorageKey(userId, rewardId));
  if (offerCache?.key.startsWith(`${userId}:${rewardId}:`)) offerCache = null;
}
