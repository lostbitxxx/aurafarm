"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { petAssetPath, type PetPose } from "@/lib/pet-assets";

export function PixelPetArt({
  petType,
  pose = "idle",
  className,
  alt = "",
}: {
  petType: string;
  pose?: PetPose;
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className ? `pixel-pet-art ${className}` : "pixel-pet-art"}
      src={petAssetPath(petType, pose)}
      alt={alt}
      draggable={false}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export function useWalkPose(active: boolean) {
  const [pose, setPose] = useState<PetPose>("idle");
  const reduced = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = media.matches;
    const onChange = () => {
      reduced.current = media.matches;
      if (media.matches) setPose("idle");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!active || reduced.current) {
      setPose("idle");
      return;
    }
    setPose("walk1");
    const id = window.setInterval(() => {
      setPose((current) => (current === "walk1" ? "walk2" : "walk1"));
    }, 250);
    return () => window.clearInterval(id);
  }, [active]);

  return pose;
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
