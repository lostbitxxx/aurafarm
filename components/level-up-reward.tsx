"use client";

import { useEffect, useId, useRef, useState } from "react";
import { claimCollectionReward } from "@/lib/actions/pets";
import { previewRewards, type PreviewReward } from "@/lib/collection-catalog";
import { SAMPLE_CLOTHES, SAMPLE_COLORS, SAMPLE_HATS } from "@/lib/pet-assets";
import { describePet, type CollectionReward, type PetCard } from "@/lib/pets";
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

type RewardTab = "colors" | "hats" | "clothes";

const REWARD_TABS: { id: RewardTab; label: string; empty: string }[] = [
  { id: "colors", label: "Colors", empty: "You already own every color." },
  { id: "hats", label: "Hats", empty: "You already own every hat." },
  { id: "clothes", label: "Clothes", empty: "You already own every outfit." },
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
  choiceNumber,
  choiceTotal,
  ownedColorIds,
  ownedHatIds,
  ownedClothesIds,
  onClaimed,
  onClose,
}: {
  choiceNumber: number;
  choiceTotal: number;
  ownedColorIds: readonly string[];
  ownedHatIds: readonly string[];
  ownedClothesIds: readonly string[];
  onClaimed: (itemId: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<RewardTab>("colors");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const colors = SAMPLE_COLORS.filter((color) => !ownedColorIds.includes(color.id));
  const hats = SAMPLE_HATS.filter((hat) => !ownedHatIds.includes(hat.id));
  const clothes = SAMPLE_CLOTHES.filter((item) => !ownedClothesIds.includes(item.id));
  const previewHats = previewRewards("hat").filter((item) => !ownedHatIds.includes(item.id));
  const previewClothes = previewRewards("clothes").filter((item) => !ownedClothesIds.includes(item.id));
  const active = REWARD_TABS.find((entry) => entry.id === tab) ?? REWARD_TABS[0];

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
    onClaimed(itemId);
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
      <div className="collection-tabs" role="tablist" aria-label="Reward categories">
        {REWARD_TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`reward-tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls={`reward-panel-${entry.id}`}
            className={tab === entry.id ? "button button-small" : "button button-small button-ghost"}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div
        className="collection-panel"
        role="tabpanel"
        id={`reward-panel-${active.id}`}
        aria-labelledby={`reward-tab-${active.id}`}
      >
        {tab === "colors" && colors.length > 0 ? (
          <ul className="collection-color-grid">
            {colors.map((color) => (
              <li key={color.id}>
                <button
                  type="button"
                  className="collection-color"
                  disabled={pendingId !== null}
                  onClick={() => onChoose(color.id)}
                >
                  <PixelPetArt petType="baby_slime" color={color.id} className="dialog-pet-art" alt="" />
                  <strong>{pendingId === color.id ? "…" : color.name}</strong>
                </button>
              </li>
            ))}
          </ul>
        ) : tab === "hats" && (hats.length > 0 || previewHats.length > 0) ? (
          <ul className="collection-color-grid">
            {previewHats.map((item) => (
              <li key={item.id}>
                <RewardAccessoryButton item={item} pending={pendingId === item.id} disabled={pendingId !== null} onChoose={onChoose} />
              </li>
            ))}
            {hats.map((hat) => (
              <li key={hat.id}>
                <button
                  type="button"
                  className="collection-color"
                  disabled={pendingId !== null}
                  onClick={() => onChoose(hat.id)}
                >
                  <PixelPetArt petType="baby_slime" hat={hat.id} className="dialog-pet-art" alt="" />
                  <strong>{pendingId === hat.id ? "…" : hat.id}</strong>
                </button>
              </li>
            ))}
          </ul>
        ) : tab === "clothes" && (clothes.length > 0 || previewClothes.length > 0) ? (
          <ul className="collection-color-grid">
            {previewClothes.map((item) => (
              <li key={item.id}>
                <RewardAccessoryButton item={item} pending={pendingId === item.id} disabled={pendingId !== null} onChoose={onChoose} />
              </li>
            ))}
            {clothes.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="collection-color"
                  disabled={pendingId !== null}
                  onClick={() => onChoose(item.id)}
                >
                  <PixelPetArt petType="baby_slime" clothes={item.id} className="dialog-pet-art" alt="" />
                  <strong>{pendingId === item.id ? "…" : item.id}</strong>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel-hint">{active.empty}</p>
        )}
      </div>
    </FarmDialog>
  );
}

function RewardAccessoryButton({
  item,
  pending,
  disabled,
  onChoose,
}: {
  item: PreviewReward;
  pending: boolean;
  disabled: boolean;
  onChoose: (itemId: string) => void;
}) {
  return (
    <button type="button" className="collection-color" disabled={disabled} onClick={() => onChoose(item.id)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="collection-accessory-art"
        src={item.icon}
        alt=""
        draggable={false}
        style={{ imageRendering: "pixelated" }}
      />
      <strong>{pending ? "…" : item.name}</strong>
    </button>
  );
}
