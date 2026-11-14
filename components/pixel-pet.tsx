"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { previewReward } from "@/lib/collection-catalog";
import {
  petAssetPath,
  sampleClothes,
  sampleColor,
  sampleHat,
  wornClothesAsset,
  type PetPose,
} from "@/lib/pet-assets";

export function PixelPetArt({
  petType,
  pose = "idle",
  color = null,
  hat = null,
  clothes = null,
  className,
  alt = "",
}: {
  petType: string;
  pose?: PetPose;
  color?: string | null;
  hat?: string | null;
  clothes?: string | null;
  className?: string;
  alt?: string;
}) {
  const [dropClothes, setDropClothes] = useState(false);
  const [dropHat, setDropHat] = useState(false);
  const hatId = sampleHat(hat);
  const clothesId = sampleClothes(clothes);
  const wornHat = !hatId && hat ? previewReward(hat) : null;
  const previewClothes = !clothesId && clothes ? previewReward(clothes) : null;
  const fittedClothes = !clothesId && clothes && !dropClothes ? wornClothesAsset(clothes, petType) : null;
  const hatIcon = wornHat?.kind === "hat" ? wornHat.icon : null;
  const clothesIcon =
    fittedClothes ?? (previewClothes?.kind === "clothes" ? previewClothes.icon : null);
  const clothesFitted = Boolean(fittedClothes);
  const src = petAssetPath(petType, pose, {
    color: sampleColor(color) ?? undefined,
    hat: dropHat ? null : hatId,
    clothes: dropClothes ? null : clothesId,
  });
  const frameClass = ["pixel-pet-art", className].filter(Boolean).join(" ");

  useEffect(() => {
    setDropClothes(false);
    setDropHat(false);
  }, [petType, pose, color, hat, clothes]);

  const body = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={hatIcon || clothesIcon ? "pixel-pet-body" : frameClass}
      src={src}
      alt={alt}
      draggable={false}
      style={{ imageRendering: "pixelated" }}
      onError={() => {
        if (clothesId && !dropClothes) setDropClothes(true);
        else if (hatId && !dropHat) setDropHat(true);
      }}
    />
  );

  if (!hatIcon && !clothesIcon) return body;

  return (
    <span className={`pixel-pet ${frameClass}`}>
      {body}
      {clothesIcon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={clothesFitted ? "pixel-pet-accessory is-worn-clothes" : "pixel-pet-accessory is-clothes"}
          src={clothesIcon}
          alt=""
          draggable={false}
          onError={() => {
            if (fittedClothes) setDropClothes(true);
          }}
        />
      ) : null}
      {hatIcon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pixel-pet-accessory is-hat" src={hatIcon} alt="" draggable={false} />
      ) : null}
    </span>
  );
}

export function useWalkPose(active: boolean) {
  const [walkFrame, setWalkFrame] = useState<PetPose>("walk1");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!active || reduceMotion) return;
    const id = window.setInterval(() => {
      setWalkFrame((current) => (current === "walk1" ? "walk2" : "walk1"));
    }, 250);
    return () => window.clearInterval(id);
  }, [active, reduceMotion]);

  // Return idle synchronously when not walking so callers never keep a raised-leg frame
  // for a render after walking stops (effect-only resets left that gap).
  if (!active || reduceMotion) return "idle";
  return walkFrame === "walk2" ? "walk2" : "walk1";
}

export function usePetting(onPet: () => void) {
  const x = useRef<number | null>(null);
  const dir = useRef(0);
  const travel = useRef(0);
  const time = useRef(0);
  const cooldown = useRef(0);

  return {
    onPointerMove(event: ReactPointerEvent) {
      const now = performance.now();
      if (now - time.current > 350) {
        dir.current = 0;
        travel.current = 0;
      }
      if (x.current !== null) {
        const dx = event.clientX - x.current;
        if (Math.abs(dx) > 1) {
          travel.current += Math.abs(dx);
          const next = Math.sign(dx);
          if (dir.current && dir.current !== next && travel.current > 16 && now > cooldown.current) {
            onPet();
            cooldown.current = now + 700;
            travel.current = 0;
          }
          dir.current = next;
        }
      }
      x.current = event.clientX;
      time.current = now;
    },
    onPointerLeave() {
      x.current = null;
      dir.current = 0;
      travel.current = 0;
    },
  };
}
