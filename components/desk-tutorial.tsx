"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DESK_TUTORIAL_STEPS,
  progressLabel,
  readTutorialRecord,
  writeTutorialRecord,
  type DeskTutorialStep,
} from "@/lib/desk-tutorial";

type Hole = { top: number; left: number; width: number; height: number };

export function useDeskTutorial(userId: string, _dialog: string | null) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [isReplay, setIsReplay] = useState(false);
  const stepRef = useRef<number | null>(null);
  const advanceLock = useRef(false);
  const clearedQuery = useRef(false);
  stepRef.current = stepIndex;

  const finish = useCallback(() => {
    advanceLock.current = false;
    writeTutorialRecord(userId, { status: "done" });
    stepRef.current = null;
    setIsReplay(false);
    setStepIndex(null);
  }, [userId]);

  const goTo = useCallback(
    (next: number) => {
      if (advanceLock.current) return;
      const current = stepRef.current;
      if (current === null) return;
      advanceLock.current = true;
      if (next < 0) {
        advanceLock.current = false;
        return;
      }
      if (next >= DESK_TUTORIAL_STEPS.length) {
        writeTutorialRecord(userId, { status: "done" });
        stepRef.current = null;
        setIsReplay(false);
        setStepIndex(null);
      } else {
        stepRef.current = next;
        setStepIndex(next);
      }
      queueMicrotask(() => {
        advanceLock.current = false;
      });
    },
    [userId],
  );

  const next = useCallback(() => {
    const current = stepRef.current;
    if (current === null) return;
    if (DESK_TUTORIAL_STEPS[current]?.id === "start") return;
    goTo(current + 1);
  }, [goTo]);

  const back = useCallback(() => {
    const current = stepRef.current;
    if (current === null || current <= 0) return;
    goTo(current - 1);
  }, [goTo]);

  const replay = useCallback(() => {
    advanceLock.current = false;
    writeTutorialRecord(userId, { status: "active", step: 0 });
    stepRef.current = 0;
    setIsReplay(true);
    setStepIndex(0);
  }, [userId]);

  useEffect(() => {
    const requested = searchParams.get("tutorial") === "1";
    function clearQuery() {
      if (!requested || clearedQuery.current) return;
      clearedQuery.current = true;
      router.replace("/dashboard");
    }
    const stored = readTutorialRecord(userId);
    if (stored?.status === "done") {
      clearQuery();
      return;
    }
    if (stepIndex !== null) {
      clearQuery();
      return;
    }
    if (stored?.status === "active") {
      setIsReplay(false);
      setStepIndex(stored.step);
      clearQuery();
      return;
    }
    if (!requested) return;
    writeTutorialRecord(userId, { status: "active", step: 0 });
    setIsReplay(false);
    setStepIndex(0);
    clearQuery();
  }, [searchParams, userId, router, stepIndex]);

  useEffect(() => {
    if (stepIndex === null) return;
    writeTutorialRecord(userId, { status: "active", step: stepIndex });
  }, [stepIndex, userId]);

  const openSection = useCallback((_section: string, open: () => void) => {
    open();
  }, []);

  /** Finish the tour and let Start studying open the tracker (return false). */
  const onStart = useCallback(() => {
    const index = stepRef.current;
    if (index === null || DESK_TUTORIAL_STEPS[index]?.id !== "start") return false;
    finish();
    return false;
  }, [finish]);

  const onMissingTarget = useCallback(() => {
    const index = stepRef.current;
    if (index === null) return;
    if (DESK_TUTORIAL_STEPS[index]?.id === "start") {
      finish();
      return;
    }
    goTo(index + 1);
  }, [finish, goTo]);

  const step = stepIndex === null ? null : DESK_TUTORIAL_STEPS[stepIndex];
  const targets = step ? [...step.targets] : [];

  return {
    step,
    stepIndex,
    isReplay,
    active: stepIndex !== null,
    targets,
    title: step?.title ?? "",
    body: step?.body ?? "",
    onSkip: finish,
    onBack: back,
    onNext: next,
    onScrim: () => undefined,
    onStart,
    onMissingTarget,
    openSection,
    replay,
  };
}

/** First on-screen match. Skips display:none copies such as the desktop coin balance. */
function visibleTutorialElement(id: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tutorial="${CSS.escape(id)}"]`);
  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    if (rect.width >= 1 && rect.height >= 1) return el;
  }
  return null;
}

function holeFromRect(rect: DOMRect, pad: number): Hole {
  const top = Math.max(8, rect.top - pad);
  const left = Math.max(8, rect.left - pad);
  const right = Math.min(window.innerWidth - 8, rect.right + pad);
  const bottom = Math.min(window.innerHeight - 8, rect.bottom + pad);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function bandBlockers(hole: Hole) {
  const right = hole.left + hole.width;
  const bottom = hole.top + hole.height;
  return [
    { top: 0, left: 0, width: "100%" as const, height: hole.top },
    { top: hole.top, left: 0, width: hole.left, height: hole.height },
    {
      top: hole.top,
      left: right,
      width: Math.max(0, window.innerWidth - right),
      height: hole.height,
    },
    {
      top: bottom,
      left: 0,
      width: "100%" as const,
      height: Math.max(0, window.innerHeight - bottom),
    },
  ];
}

export function DeskTutorial({
  step,
  stepIndex,
  title,
  body,
  targets,
  isReplay,
  onSkip,
  onBack,
  onNext,
  onScrim,
  onMissingTarget,
}: {
  step: DeskTutorialStep;
  stepIndex: number;
  title: string;
  body: string;
  targets: readonly string[];
  isReplay: boolean;
  onSkip: () => void;
  onBack: () => void;
  onNext: () => void;
  onScrim: () => void;
  onMissingTarget: () => void;
}) {
  const titleId = useId();
  const maskId = useId();
  const [holes, setHoles] = useState<Hole[]>([]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [above, setAbove] = useState(false);
  const [cardLeft, setCardLeft] = useState(16);
  const [cardTop, setCardTop] = useState(16);
  const scrolled = useRef("");
  const isStart = step.id === "start";
  const isWelcome = step.id === "welcome";
  const targetKey = targets.join(",");
  const pad = isWelcome ? 4 : 8;

  useEffect(() => {
    let frames = 0;
    let frame = 0;
    let gaveUp = false;
    let lastSignature = "";
    let observer: ResizeObserver | null = null;
    let mutations: MutationObserver | null = null;

    function visibleTargets() {
      return targets
        .map((id) => visibleTutorialElement(id))
        .filter((el): el is HTMLElement => el !== null);
    }

    function measure() {
      const els = visibleTargets();
      const signature = [
        window.innerWidth,
        window.innerHeight,
        ...els.map((el) => {
          const rect = el.getBoundingClientRect();
          return `${rect.top},${rect.left},${rect.width},${rect.height}`;
        }),
      ].join("|");
      if (els.length > 0 && signature === lastSignature) return;
      lastSignature = signature;
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      if (els.length === 0) {
        setHoles([]);
        const cardWidth = Math.min(288, window.innerWidth - 24);
        setAbove(false);
        setCardLeft(Math.max(12, window.innerWidth - cardWidth - 24));
        setCardTop(Math.max(12, (window.innerHeight - 168) / 2));
        return;
      }
      if (scrolled.current !== targetKey) {
        scrolled.current = targetKey;
        els[0]?.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      const nextHoles = els.map((el) => holeFromRect(el.getBoundingClientRect(), pad));
      setHoles(nextHoles);

      const anchor = nextHoles[0];
      if (!anchor) return;
      const cardWidth = Math.min(288, window.innerWidth - 24);
      const estimated = 168;
      const gap = 12;
      // Welcome covers the whole room, so a card below or above it slides off-screen.
      // Keep the copy inside the room, centered on the right side.
      if (isWelcome) {
        const inset = 18;
        const minLeft = Math.max(12, anchor.left + 12);
        const maxLeft = anchor.left + anchor.width - cardWidth - inset;
        const nextLeft = Math.min(Math.max(maxLeft, minLeft), window.innerWidth - 12 - cardWidth);
        const minTop = Math.max(12, anchor.top + 12);
        const maxTop = anchor.top + anchor.height - estimated - 12;
        const nextTop = Math.min(
          Math.max(anchor.top + (anchor.height - estimated) / 2, minTop),
          Math.max(minTop, maxTop),
        );
        setAbove(false);
        setCardTop(Math.max(12, nextTop));
        setCardLeft(Math.max(12, nextLeft));
        return;
      }
      let placeAbove = false;
      let nextTop = anchor.top + anchor.height + gap;
      let nextLeft = anchor.left;
      if (nextTop + estimated > window.innerHeight - 12) {
        placeAbove = true;
        nextTop = Math.max(12, anchor.top - gap);
      }
      if (nextLeft + cardWidth > window.innerWidth - 12) nextLeft = window.innerWidth - 12 - cardWidth;
      if (nextLeft < 12) nextLeft = 12;
      setAbove(placeAbove);
      setCardTop(nextTop);
      setCardLeft(nextLeft);
    }

    function pump() {
      measure();
      if (gaveUp || visibleTargets().length > 0) return;
      frames += 1;
      if (frames > 12) {
        gaveUp = true;
        onMissingTarget();
        return;
      }
      frame = window.requestAnimationFrame(pump);
    }

    pump();
    const els = visibleTargets();
    if (els.length > 0 && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      for (const el of els) observer.observe(el);
    }
    if (typeof MutationObserver !== "undefined") {
      mutations = new MutationObserver(measure);
      mutations.observe(document.body, { childList: true, subtree: true });
    }
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      mutations?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [isWelcome, onMissingTarget, pad, targetKey, targets]);

  const label = progressLabel(stepIndex);
  const progressLabelText = `Step ${stepIndex + 1} of ${DESK_TUTORIAL_STEPS.length}`;

  if (viewport.width < 1) return null;

  const primary = holes[0];
  const startBands = isStart && primary ? bandBlockers(primary) : null;

  return (
    <div className="tutorial-layer">
      <svg
        className="tutorial-scrim-svg"
        width={viewport.width}
        height={viewport.height}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        aria-hidden="true"
      >
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width={viewport.width} height={viewport.height} fill="white" />
            {holes.map((hole, index) => (
              <rect
                key={`cut-${index}`}
                x={hole.left}
                y={hole.top}
                width={hole.width}
                height={hole.height}
                rx={isWelcome ? 12 : 14}
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={viewport.width}
          height={viewport.height}
          fill="rgba(16, 32, 24, 0.72)"
          mask={`url(#${maskId})`}
        />
      </svg>

      {isStart && startBands
        ? startBands.map((band) => (
            <div
              key={`${band.top}-${band.left}-${band.width}-${band.height}`}
              className="tutorial-block"
              style={band}
              onClick={onScrim}
            />
          ))
        : (
          <div className="tutorial-block is-full" onClick={onScrim} />
        )}

      {holes.map((hole, index) => (
        <div key={`ring-${index}`} className="tutorial-ring" style={hole} />
      ))}

      <div
        className={above ? "tutorial-card is-above" : "tutorial-card"}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        style={{ top: cardTop, left: cardLeft }}
      >
        <p className="tutorial-progress" aria-label={progressLabelText}>
          {label}
        </p>
        <h2 id={titleId}>{title}</h2>
        <p>{body}</p>
        <div className="tutorial-actions">
          <button type="button" className="tutorial-nav" onClick={onBack} disabled={stepIndex <= 0}>
            Back
          </button>
          {!isStart ? (
            <button type="button" className="tutorial-nav is-primary" onClick={onNext}>
              Next
            </button>
          ) : (
            <button type="button" className="tutorial-nav is-primary" onClick={onSkip}>
              Finish Tutorial
            </button>
          )}
          {isReplay && !isStart ? (
            <button type="button" className="tutorial-skip" onClick={onSkip}>
              Skip tutorial
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
