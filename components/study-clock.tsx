"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock, remainingSeconds, type ActiveStudySession } from "@/lib/study";

export function StudyClock({
  session,
  rushed,
  onFinished,
}: {
  session: ActiveStudySession;
  rushed: boolean;
  onFinished: (() => Promise<{ error: string }>) | null;
}) {
  const [now, setNow] = useState<number | null>(null);
  const attempt = useRef<string | null>(null);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  });

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [session.id]);

  const remaining = rushed
    ? 0
    : now === null
      ? null
      : remainingSeconds(session.startedAt, session.plannedSeconds, now);

  useEffect(() => {
    if (!onFinishedRef.current) return;
    if (now === null || remaining === null || remaining > 0) return;
    if (attempt.current === session.id) return;
    attempt.current = session.id;
    void onFinishedRef.current().then((result) => {
      if (result.error === "Study time has not finished") attempt.current = null;
    });
  }, [now, remaining, session.id]);

  return (
    <p className="study-clock" role="timer">
      {remaining === null ? "—" : formatClock(remaining)}
    </p>
  );
}
