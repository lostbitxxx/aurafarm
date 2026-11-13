"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { claimCollectionReward } from "@/lib/actions/pets";
import { previewReward, previewRewards, type PreviewReward } from "@/lib/collection-catalog";
import { SAMPLE_CLOTHES, SAMPLE_COLORS, SAMPLE_HATS } from "@/lib/pet-assets";
import { describePet, type CollectionReward, type PetCard } from "@/lib/pets";
import {
  canShuffleReward,
  forgetRewardOffer,
  REWARD_SHUFFLE_LIMIT,
  rewardOfferServerSnapshot,
  rewardOfferSnapshot,
  saveRewardOffer,
  shuffleRewardOffer,
  subscribeRewardOffers,
  type RewardPools,
} from "@/lib/reward-offer";
import { rememberSeenRewards } from "@/lib/reward-seen";
import { FarmDialog } from "./farm-dialog";
import { PixelPetArt } from "./pixel-pet";

const CONFETTI = [
  { left: "6%", delay: "0s", duration: "1.7s", color: "#c6ef4a", rotate: "-16deg" },
  { left: "14%", delay: "0.15s", duration: "1.9s", color: "#fff8e8", rotate: "12deg" },
  { left: "22%", delay: "0.05s", duration: "1.6s", color: "#e39a45", rotate: "24deg" },
  { left: "31%", delay: "0.28s", duration: "2s", color: "#9bc72d", rotate: "-8deg" },
  { left: "40%", delay: "0.08s", duration: "1.8s", color: "#f7f3e8", rotate: "18deg" },
  { left: "48%", delay: "0.22s", duration: "1.65s", color: "#c6ef4a", rotate: "-22deg" },
  { left: "57%", delay: "0.02s", duration: "1.85s", color: "#e39a45", rotate: "8deg" },
  { left: "66%", delay: "0.18s", duration: "1.75s", color: "#fff8e8", rotate: "-14deg" },
  { left: "74%", delay: "0.1s", duration: "2.05s", color: "#9bc72d", rotate: "20deg" },
  { left: "83%", delay: "0.26s", duration: "1.7s", color: "#c6ef4a", rotate: "-6deg" },
  { left: "91%", delay: "0.04s", duration: "1.9s", color: "#e39a45", rotate: "16deg" },
  { left: "18%", delay: "0.34s", duration: "2.1s", color: "#fff8e8", rotate: "-20deg" },
  { left: "52%", delay: "0.32s", duration: "1.95s", color: "#f7f3e8", rotate: "10deg" },
  { left: "78%", delay: "0.12s", duration: "1.8s", color: "#c6ef4a", rotate: "-12deg" },
];

export function LevelUpCelebration({
  reward,
  pet,
  userId,
  markIds,
  onContinue,
  onDismiss,
}: {
  reward: CollectionReward;
  pet: PetCard;
  userId: string;
  markIds: string;
  onContinue: () => void;
  onDismiss: () => void;
}) {
  const titleId = useId();
  const continueRef = useRef<HTMLButtonElement>(null);
  const copy = describePet(pet.pet_type);

  useEffect(() => {
    if (markIds) rememberSeenRewards(userId, markIds.split("|").filter(Boolean));
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    continueRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        continueRef.current?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [markIds, onDismiss, userId]);

  return (
    <div className="level-up" role="presentation" onClick={onDismiss}>
      <div
        className="level-up-stage"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="level-up-confetti" aria-hidden="true">
          {CONFETTI.map((bit) => (
            <span
              key={`${bit.left}-${bit.delay}`}
              className="level-up-bit"
              style={{
                left: bit.left,
                background: bit.color,
                animationDelay: bit.delay,
                animationDuration: bit.duration,
                transform: `rotate(${bit.rotate})`,
              }}
            />
          ))}
        </div>
        <div className="level-up-rays" aria-hidden="true" />
        <div className="level-up-light" aria-hidden="true" />
        <PixelPetArt
          petType={pet.pet_type}
          color={pet.color}
          hat={pet.hat}
          clothes={pet.clothes}
          className="level-up-pet"
          alt={copy.name}
        />
        <div className="level-up-copy">
          <p className="level-up-kicker">{copy.name}</p>
          <h2 id={titleId} className="level-up-title">
            Level {reward.levelReached}
          </h2>
        </div>
        <button ref={continueRef} type="button" className="button" onClick={onContinue}>
          Choose a reward
        </button>
      </div>
    </div>
  );
}

export function RewardPicker({
  rewardId,
  userId,
  choiceNumber,
  choiceTotal,
  ownedColorIds,
  ownedHatIds,
  ownedClothesIds,
  onClaimed,
  onClose,
}: {
  rewardId: string;
  userId: string;
  choiceNumber: number;
  choiceTotal: number;
  ownedColorIds: readonly string[];
  ownedHatIds: readonly string[];
  ownedClothesIds: readonly string[];
  onClaimed: (itemId: string) => void;
  onClose: () => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pools = useMemo<RewardPools>(
    () => ({
      colors: SAMPLE_COLORS.filter((color) => !ownedColorIds.includes(color.id)).map((color) => color.id),
      hats: [
        ...previewRewards("hat")
          .filter((item) => !ownedHatIds.includes(item.id))
          .map((item) => item.id),
        ...SAMPLE_HATS.filter((hat) => !ownedHatIds.includes(hat.id)).map((hat) => hat.id),
      ],
      clothes: [
        ...previewRewards("clothes")
          .filter((item) => !ownedClothesIds.includes(item.id))
          .map((item) => item.id),
        ...SAMPLE_CLOTHES.filter((item) => !ownedClothesIds.includes(item.id)).map((item) => item.id),
      ],
    }),
    [ownedClothesIds, ownedColorIds, ownedHatIds],
  );
  const offer = useSyncExternalStore(
    subscribeRewardOffers,
    () => rewardOfferSnapshot(userId, rewardId, pools),
    rewardOfferServerSnapshot,
  );
  const cards = offer
    ? [
        offer.colorId ? { kind: "Color" as const, id: offer.colorId } : null,
        offer.hatId ? { kind: "Hat" as const, id: offer.hatId } : null,
        offer.clothesId ? { kind: "Clothes" as const, id: offer.clothesId } : null,
      ].filter((card) => card !== null)
    : [];
  const shufflesLeft = offer ? REWARD_SHUFFLE_LIMIT - offer.shufflesUsed : REWARD_SHUFFLE_LIMIT;
  const shuffleReady = offer ? canShuffleReward(offer, pools) : false;

  async function onChoose(itemId: string) {
    if (pendingId) return;
    setError(null);
    setPendingId(itemId);
    const result = await claimCollectionReward(itemId);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    forgetRewardOffer(userId, rewardId);
    onClaimed(itemId);
  }

  function onShuffle() {
    if (!offer) return;
    const next = shuffleRewardOffer(offer, pools);
    if (!next) return;
    saveRewardOffer(userId, rewardId, pools, next);
  }

  return (
    <FarmDialog title="Choose a reward" onClose={onClose} wide>
      <p className="panel-hint">
        {choiceNumber} of {choiceTotal}. Pick one color, hat, or outfit.
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {!offer ? (
        <p className="panel-hint">Drawing a reward…</p>
      ) : cards.length > 0 ? (
        <ul className="collection-color-grid">
          {cards.map((card) => (
            <li key={`${card.kind}-${card.id}`}>
              <RewardChoiceButton
                kind={card.kind}
                itemId={card.id}
                pending={pendingId === card.id}
                disabled={pendingId !== null}
                onChoose={onChoose}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel-hint">You already own every color, hat, and outfit.</p>
      )}
      <div className="reward-shuffle">
        <button
          type="button"
          className="button button-small button-ghost"
          disabled={!shuffleReady || pendingId !== null}
          onClick={onShuffle}
        >
          {shufflesLeft === 0 ? "No shuffles left" : `Shuffle (${shufflesLeft} left)`}
        </button>
      </div>
    </FarmDialog>
  );
}

function RewardChoiceButton({
  kind,
  itemId,
  pending,
  disabled,
  onChoose,
}: {
  kind: "Color" | "Hat" | "Clothes";
  itemId: string;
  pending: boolean;
  disabled: boolean;
  onChoose: (itemId: string) => void;
}) {
  const preview = kind === "Color" ? null : previewReward(itemId);
  const colorName = SAMPLE_COLORS.find((color) => color.id === itemId)?.name ?? itemId;
  const name = kind === "Color" ? colorName : (preview?.name ?? itemId);
  return (
    <button type="button" className="collection-color" disabled={disabled} onClick={() => onChoose(itemId)}>
      <span className="reward-offer-kind">{kind}</span>
      {kind === "Color" ? (
        <PixelPetArt petType="baby_slime" color={itemId} className="dialog-pet-art" alt="" />
      ) : preview ? (
        <RewardAccessoryArt item={preview} />
      ) : (
        <PixelPetArt
          petType="baby_slime"
          hat={kind === "Hat" ? itemId : null}
          clothes={kind === "Clothes" ? itemId : null}
          className="dialog-pet-art"
          alt=""
        />
      )}
      <strong>{pending ? "…" : name}</strong>
    </button>
  );
}

function RewardAccessoryArt({ item }: { item: PreviewReward }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="collection-accessory-art"
      src={item.icon}
      alt=""
      draggable={false}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
