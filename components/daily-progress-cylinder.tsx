"use client";

import type { CSSProperties } from "react";
import {
  CYLINDER_RULER_LINES,
  cylinderCaption,
  cylinderHeat,
  cylinderProgress,
  cylinderTone,
} from "@/lib/daily-cylinder";

export function DailyProgressCylinder({
  studiedMinutes,
  goalMinutes,
  isStudyDay,
}: {
  studiedMinutes: number;
  goalMinutes: number;
  isStudyDay: boolean;
}) {
  const progress = cylinderProgress(studiedMinutes, goalMinutes);
  const tone = cylinderTone(isStudyDay);
  const heat = cylinderHeat(progress.ratio);
  const caption = cylinderCaption(studiedMinutes, goalMinutes, isStudyDay);

  return (
    <div
      className={`room-cylinder is-${tone}${progress.goalMet ? " is-burning" : ""}`}
      style={
        {
          "--cylinder-heat": String(heat),
          "--cylinder-ratio": String(progress.ratio),
        } as CSSProperties
      }
      role="meter"
      aria-valuemin={0}
      aria-valuemax={progress.goalMinutes}
      aria-valuenow={Math.min(progress.studiedMinutes, progress.goalMinutes)}
      aria-label={caption}
    >
      <p className="room-cylinder-caption">{caption}</p>
      <div className="room-cylinder-tube" aria-hidden="true">
        <span className="room-cylinder-track">
          {/* Clipped by the track’s rounded top so full fill stays inside the pill. */}
          <span className="room-cylinder-liquid" />
        </span>
        <span className="room-cylinder-ruler">
          {CYLINDER_RULER_LINES.map((line) => {
            const inLiquid = line / 8 <= progress.ratio;
            return (
              <i
                key={line}
                className={inLiquid ? "is-in-liquid" : undefined}
                style={{ bottom: `${(line / 8) * 100}%` }}
              />
            );
          })}
        </span>
        {/* Border overlay so the pill rim stays above the liquid at full fill. */}
        <span className="room-cylinder-shell" />
      </div>
      {progress.goalMet ? (
        <span className="room-cylinder-fire" aria-hidden="true">
          {/*
            SVG sheet is 8×(20×22) frames L→R. Clipped viewport shows one cell;
            the strip steps 20px-native (×3 here) so only one flame is visible.
          */}
          <img
            className="room-cylinder-fire-strip"
            src="/room-cylinder-fire.svg"
            alt=""
            width={480}
            height={66}
            draggable={false}
          />
        </span>
      ) : null}
    </div>
  );
}
