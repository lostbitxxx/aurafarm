import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canShuffleReward,
  drawRewardOffer,
  REWARD_SHUFFLE_LIMIT,
  restoreRewardOffer,
  shuffleRewardOffer,
  type RewardOffer,
  type RewardPools,
} from "../lib/reward-offer";

const pools: RewardPools = {
  colors: ["honey", "sage", "mint"],
  hats: ["little-gentleman-top-hat", "hat_a"],
  clothes: ["little-gentleman-suit"],
};

function sequence(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

test("a reward offer draws one unowned color, hat, and outfit", () => {
  const offer = drawRewardOffer(pools, sequence([0, 0.9, 0]));
  assert.equal(offer.colorId, "honey");
  assert.equal(offer.hatId, "hat_a");
  assert.equal(offer.clothesId, "little-gentleman-suit");
  assert.equal(offer.shufflesUsed, 0);
  assert.equal(drawRewardOffer({ colors: [], hats: ["hat_a"], clothes: [] }).hatId, "hat_a");
  assert.equal(drawRewardOffer({ colors: [], hats: [], clothes: [] }).colorId, null);
});

test("shuffle changes the drawn items and stops after three uses", () => {
  const first = drawRewardOffer(pools, sequence([0, 0, 0]));
  const second = shuffleRewardOffer(first, pools, sequence([0, 0, 0]));
  assert.ok(second);
  assert.equal(second.colorId, "sage");
  assert.equal(second.hatId, "hat_a");
  assert.equal(second.clothesId, "little-gentleman-suit");
  assert.equal(second.shufflesUsed, 1);

  let current: RewardOffer = second;
  for (let used = 2; used <= REWARD_SHUFFLE_LIMIT; used += 1) {
    const next = shuffleRewardOffer(current, pools, () => 0);
    assert.ok(next);
    assert.equal(next.shufflesUsed, used);
    current = next;
  }
  assert.equal(canShuffleReward(current, pools), false);
  assert.equal(shuffleRewardOffer(current, pools, () => 0), null);
});

test("shuffle stays unused when each category has only one unowned item", () => {
  const only: RewardPools = { colors: ["sage"], hats: ["hat_a"], clothes: ["clothes_a"] };
  const offer = drawRewardOffer(only, () => 0);
  assert.equal(canShuffleReward(offer, only), false);
  assert.equal(shuffleRewardOffer(offer, only, () => 0), null);
});

test("a saved offer keeps its items and replaces one that is no longer unowned", () => {
  const stored: RewardOffer = {
    colorId: "honey",
    hatId: "hat_a",
    clothesId: "old-outfit",
    shufflesUsed: 2,
  };
  const restored = restoreRewardOffer(stored, pools, sequence([0, 0, 0]));
  assert.equal(restored.colorId, "honey");
  assert.equal(restored.hatId, "hat_a");
  assert.equal(restored.clothesId, "little-gentleman-suit");
  assert.equal(restored.shufflesUsed, 2);
});
