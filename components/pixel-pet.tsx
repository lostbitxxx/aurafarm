"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { previewReward } from "@/lib/collection-catalog";
import {
  petStackLayers,
  sampleClothes,
  sampleColor,
  sampleHat,
  wornClothesAsset,
  wornHatAsset,
  type PetPose,
} from "@/lib/pet-assets";

function LayerImg({
  src,
  className,
  alt = "",
  onError,
}: {
  src: string;
  className: string;
  alt?: string;
  onError?: () => void;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={src}
      alt={alt}
      draggable={false}
      style={{ imageRendering: "pixelated" }}
      onError={onError}
    />
  );
}

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
  const previewHat = !hatId && hat ? previewReward(hat) : null;
  const previewClothes = !clothesId && clothes ? previewReward(clothes) : null;
  const fittedHat = !dropHat ? wornHatAsset(hat) : null;
  const fittedClothes = !dropClothes ? wornClothesAsset(clothes, petType) : null;
  // Collection preview cards that lack a fitted worn asset still use the catalogue icon.
  const previewHatIcon = !fittedHat && previewHat?.kind === "hat" ? previewHat.icon : null;
  const previewClothesIcon =
    !fittedClothes && previewClothes?.kind === "clothes" ? previewClothes.icon : null;

  const stack = petStackLayers(petType, pose, {
    color: sampleColor(color) ?? undefined,
    hat: dropHat ? null : hat,
    clothes: dropClothes ? null : clothes,
  });

  const frameClass = [
    "pixel-pet",
    "pixel-pet-art",
    stack.stage === "study" ? "is-study" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    setDropClothes(false);
    setDropHat(false);
  }, [petType, pose, color, hat, clothes]);

  return (
    <span className={frameClass}>
      {stack.floor ? <LayerImg className="pixel-pet-layer is-floor" src={stack.floor} /> : null}
      {stack.chair ? <LayerImg className="pixel-pet-layer is-chair" src={stack.chair} /> : null}
      <span className="pixel-pet-figure">
        {stack.shadow ? <LayerImg className="pixel-pet-layer is-shadow" src={stack.shadow} /> : null}
        <LayerImg className="pixel-pet-layer is-legs" src={stack.legs} />
        <LayerImg className="pixel-pet-layer is-body" src={stack.body} alt={alt} />
        {stack.clothes ? (
          <LayerImg
            className="pixel-pet-layer is-worn-clothes"
            src={stack.clothes}
            onError={() => setDropClothes(true)}
          />
        ) : previewClothesIcon ? (
          <LayerImg
            className="pixel-pet-accessory is-clothes"
            src={previewClothesIcon}
            onError={() => setDropClothes(true)}
          />
        ) : null}
        <LayerImg className="pixel-pet-layer is-face" src={stack.face} />
        {stack.hat ? (
          <LayerImg
            // Sample hats (hat_a/hat_b) are body-aligned 42×42 overlays.
            // Collection worn hats are catalogue-framed art — pin/scale to the head.
            className={hatId ? "pixel-pet-layer is-worn-hat" : "pixel-pet-accessory is-hat"}
            src={stack.hat}
            onError={() => setDropHat(true)}
          />
        ) : previewHatIcon ? (
          <LayerImg className="pixel-pet-accessory is-hat" src={previewHatIcon} />
        ) : null}
      </span>
      {stack.desk ? <LayerImg className="pixel-pet-layer is-desk" src={stack.desk} /> : null}
      {stack.pen ? <LayerImg className="pixel-pet-layer is-pen" src={stack.pen} /> : null}
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
            cooldown.current = now + 900;
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
