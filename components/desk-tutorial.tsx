"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DESK_TUTORIAL_STEPS,
  progressLabel,
  readTutorialRecord,
  sectionMatchesStep,
  writeTutorialRecord,
  type DeskTutorialStep,
} from "@/lib/desk-tutorial";

const SOCIAL_LOOKING =
  "Friends, FarmCrew, Social Settings, and the Leaderboard are in here. Close this menu to continue.";
const CLOSE_PROMPT = "Click close to continue.";

type Hole = { top: number; left: number; width: number; height: number };

export function useDeskTutorial(userId: string, dialog: string | null) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<"point" | "looking">("point");
  const [socialPinned, setSocialPinned] = useState(false);
  const stepRef = useRef<number | null>(null);
  const awaitingClose = useRef(false);
  const advanceLock = useRef(false);
  const clearedQuery = useRef(false);
  stepRef.current = stepIndex;

  const finish = useCallback(() => {
    awaitingClose.current = false;
    advanceLock.current = false;
    writeTutorialRecord(userId, { status: "done" });
    stepRef.current = null;
    setSocialPinned(false);
    setPhase("point");
    setStepIndex(null);
  }, [userId]);

  const advance = useCallback(() => {
    if (advanceLock.current) return;
    const current = stepRef.current;
    if (current === null) return;
    advanceLock.current = true;
    awaitingClose.current = false;
    setSocialPinned(false);
    setPhase("point");
    const next = current + 1;
    if (next >= DESK_TUTORIAL_STEPS.length) {
      writeTutorialRecord(userId, { status: "done" });
      stepRef.current = null;
      setStepIndex(null);
    } else {
      stepRef.current = next;
      setStepIndex(next);
    }
    queueMicrotask(() => {
      advanceLock.current = false;
    });
  }, [userId]);

  const retreat = useCallback(() => {
    if (advanceLock.current) return;
    const current = stepRef.current;
    if (current === null || current <= 0) return;
    advanceLock.current = true;
    awaitingClose.current = false;
    setSocialPinned(false);
    setPhase("point");
    const previous = current - 1;
    stepRef.current = previous;
    setStepIndex(previous);
    queueMicrotask(() => {
      advanceLock.current = false;
    });
  }, []);

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
      setPhase("point");
      setStepIndex(stored.step);
      clearQuery();
      return;
    }
    if (!requested) return;
    writeTutorialRecord(userId, { status: "active", step: 0 });
    setPhase("point");
    setStepIndex(0);
    clearQuery();
  }, [searchParams, userId, router, stepIndex]);

  useEffect(() => {
    if (stepIndex === null) return;
    writeTutorialRecord(userId, { status: "active", step: stepIndex });
  }, [stepIndex, userId]);

  useEffect(() => {
    if (dialog !== null) return;
    if (!awaitingClose.current) return;
    awaitingClose.current = false;
    advance();
  }, [dialog, advance]);

  const openSection = useCallback((section: string, open: () => void) => {
    const index = stepRef.current;
    if (index === null) {
      open();
      return;
    }
    const step = DESK_TUTORIAL_STEPS[index];
    if (!step || !sectionMatchesStep(step, section)) return;
    open();
    awaitingClose.current = true;
    setSocialPinned(false);
    setPhase("looking");
  }, []);

  const dismissSocial = useCallback(() => {
    const index = stepRef.current;
    if (index === null || DESK_TUTORIAL_STEPS[index]?.id !== "social") return;
    if (phase !== "looking") return;
    if (dialog !== null || awaitingClose.current) return;
    setSocialPinned(false);
    advance();
  }, [advance, dialog, phase]);

  const onSocialClick = useCallback(() => {
    const index = stepRef.current;
    if (index === null || DESK_TUTORIAL_STEPS[index]?.id !== "social") return;
    if (phase === "point") {
      setSocialPinned(true);
      setPhase("looking");
      return;
    }
    dismissSocial();
  }, [dismissSocial, phase]);

  const onStart = useCallback(() => {
    const index = stepRef.current;
    if (index === null || DESK_TUTORIAL_STEPS[index]?.id !== "start") return;
    finish();
  }, [finish]);

  const onMissingTarget = useCallback(() => {
    const index = stepRef.current;
    if (index === null || DESK_TUTORIAL_STEPS[index]?.kind !== "start") return;
    finish();
  }, [finish]);

  const step = stepIndex === null ? null : DESK_TUTORIAL_STEPS[stepIndex];
  const covered = Boolean(step && phase === "looking" && dialog !== null);
  const body = covered
    ? CLOSE_PROMPT
    : step?.id === "social" && phase === "looking"
      ? SOCIAL_LOOKING
      : (step?.body ?? "");

  return {
    step,
    stepIndex,
    socialPinned,
    includeMenu: Boolean(step?.id === "social" && socialPinned && !covered),
    covered,
    title: covered ? "Close" : (step?.title ?? ""),
    body,
    ringTarget: covered ? "close" : (step?.target ?? ""),
    holeTarget: covered ? "dialog" : null,
    onNext: advance,
    onPrev: retreat,
    onSkip: finish,
    onScrim: dismissSocial,
    onSocialClick,
    onStart,
    onMissingTarget,
    openSection,
  };
}

function bounds(rects: DOMRect[], pad: number): Hole {
  const top = Math.max(8, Math.min(...rects.map((rect) => rect.top)) - pad);
  const left = Math.max(8, Math.min(...rects.map((rect) => rect.left)) - pad);
  const right = Math.min(window.innerWidth - 8, Math.max(...rects.map((rect) => rect.right)) + pad);
  const bottom = Math.min(window.innerHeight - 8, Math.max(...rects.map((rect) => rect.bottom)) + pad);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

export function DeskTutorial({
  stepIndex,
  title,
  body,
  ringTarget,
  holeTarget = null,
  includeMenu,
  onNext,
  onPrev,
  onSkip,
  onScrim,
  onMissingTarget,
}: {
  step: DeskTutorialStep;
  stepIndex: number;
  title: string;
  body: string;
  ringTarget: string;
  holeTarget?: string | null;
  includeMenu: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onScrim: () => void;
  onMissingTarget: () => void;
}) {
  const titleId = useId();
  const [hole, setHole] = useState<Hole | null>(null);
  const [ring, setRing] = useState<Hole | null>(null);
  const [above, setAbove] = useState(false);
  const [cardLeft, setCardLeft] = useState(16);
  const [cardTop, setCardTop] = useState(16);
  const scrolled = useRef("");

  useEffect(() => {
    let frames = 0;
    let frame = 0;
    let observer: ResizeObserver | null = null;

    function measure() {
      const ringEl = document.querySelector<HTMLElement>(`[data-tutorial="${ringTarget}"]`);
      const holeEl = holeTarget
        ? document.querySelector<HTMLElement>(`[data-tutorial="${holeTarget}"]`)
        : ringEl;
      if (!ringEl || !holeEl) {
        setHole(null);
        setRing(null);
        frames += 1;
        if (frames > 12) onMissingTarget();
        else frame = window.requestAnimationFrame(measure);
        return;
      }
      if (!holeTarget && scrolled.current !== ringTarget) {
        scrolled.current = ringTarget;
        ringEl.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      const holeRects = [holeEl.getBoundingClientRect()];
      const ringRects = [ringEl.getBoundingClientRect()];
      if (includeMenu) {
        const menu = ringEl.querySelector<HTMLElement>(".topbar-menu-list");
        if (menu) {
          const menuRect = menu.getBoundingClientRect();
          if (menuRect.width > 0 && menuRect.height > 0) {
            holeRects.push(menuRect);
            ringRects.push(menuRect);
          }
        }
      }
      const nextHole = bounds(holeRects, 8);
      const nextRing = bounds(ringRects, holeTarget ? 6 : 8);
      setHole(nextHole);
      setRing(nextRing);
      const cardWidth = Math.min(288, window.innerWidth - 24);
      const estimated = 168;
      const gap = 12;
      let placeAbove = false;
      let nextTop = nextRing.top + nextRing.height + gap;
      let nextLeft = nextRing.left;
      if (holeTarget) {
        const leftOf = nextHole.left - cardWidth - gap;
        if (leftOf >= 12) {
          nextLeft = leftOf;
          nextTop = Math.max(12, nextHole.top);
        } else if (nextHole.top + nextHole.height + gap + estimated < window.innerHeight - 12) {
          nextTop = nextHole.top + nextHole.height + gap;
          nextLeft = nextHole.left;
        } else {
          placeAbove = true;
          nextTop = Math.max(12, nextHole.top - gap);
          nextLeft = nextHole.left;
        }
      } else if (nextTop + estimated > window.innerHeight - 12) {
        placeAbove = true;
        nextTop = nextRing.top - gap;
      }
      if (nextLeft + cardWidth > window.innerWidth - 12) nextLeft = window.innerWidth - 12 - cardWidth;
      if (nextLeft < 12) nextLeft = 12;
      setAbove(placeAbove);
      setCardTop(nextTop);
      setCardLeft(nextLeft);
    }

    measure();
    const ringEl = document.querySelector<HTMLElement>(`[data-tutorial="${ringTarget}"]`);
    const holeEl = holeTarget ? document.querySelector<HTMLElement>(`[data-tutorial="${holeTarget}"]`) : null;
    if ((ringEl || holeEl) && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      if (ringEl) observer.observe(ringEl);
      if (holeEl) observer.observe(holeEl);
      const menu = ringEl?.querySelector<HTMLElement>(".topbar-menu-list");
      if (menu) observer.observe(menu);
    }
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [holeTarget, includeMenu, onMissingTarget, ringTarget]);

  const label = progressLabel(stepIndex);
  const progressLabelText = `Step ${stepIndex + 1} of ${DESK_TUTORIAL_STEPS.length}`;

  if (!hole || !ring) return null;

  const right = hole.left + hole.width;
  const bottom = hole.top + hole.height;
  const bands = [
    { top: 0, left: 0, width: "100%", height: hole.top },
    { top: hole.top, left: 0, width: hole.left, height: hole.height },
    { top: hole.top, left: right, width: Math.max(0, window.innerWidth - right), height: hole.height },
    { top: bottom, left: 0, width: "100%", height: Math.max(0, window.innerHeight - bottom) },
  ];

  return (
    <div className="tutorial-layer">
      {bands.map((band) => (
        <div
          key={`${band.top}-${band.left}-${band.width}-${band.height}`}
          className="tutorial-scrim"
          style={band}
          onClick={onScrim}
        />
      ))}
      <div className={holeTarget ? "tutorial-ring is-circle" : "tutorial-ring"} style={ring} />
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
          {stepIndex > 0 ? (
            <button type="button" className="tutorial-prev" onClick={onPrev}>
              Prev
            </button>
          ) : null}
          <button type="button" className="tutorial-next" onClick={onNext}>
            {stepIndex === DESK_TUTORIAL_STEPS.length - 1 ? "Finish tutorial" : "Next"}
          </button>
          <button type="button" className="tutorial-skip" onClick={onSkip}>
            Skip tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
