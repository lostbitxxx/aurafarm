"use client";

import type { CSSProperties } from "react";
import {
  CYLINDER_RULER_LINES,
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
  const label = isStudyDay
    ? progress.goalMet
      ? `Daily goal met: ${progress.studiedMinutes} of ${progress.goalMinutes} minutes`
      : `Daily progress: ${progress.studiedMinutes} of ${progress.goalMinutes} minutes`
    : progress.goalMet
      ? `Rest day bonus: ${progress.studiedMinutes} of ${progress.goalMinutes} optional minutes`
      : `Rest day: ${progress.studiedMinutes} of ${progress.goalMinutes} optional minutes`;

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
      aria-label={label}
    >
      <div className="room-cylinder-tube" aria-hidden="true">
        <span className="room-cylinder-track" />
        <span className="room-cylinder-liquid" />
        <span className="room-cylinder-ruler">
          {CYLINDER_RULER_LINES.map((line) => (
            <i key={line} style={{ bottom: `${(line / 8) * 100}%` }} />
          ))}
        </span>
        {progress.goalMet ? <span className="room-cylinder-fire" /> : null}
      </div>
    </div>
  );
}
