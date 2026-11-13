import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { SocialPresence } from "@/components/social-presence";
import { formatDuration, formatTimestamp } from "@/lib/study";
import { loadStudyScore, type LoadedStudyScore } from "@/lib/study-score";

export const metadata: Metadata = {
  title: "Session",
};

export const instant = false;

export default async function StudyScorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const score = await loadStudyScore(id);
  const copy = sessionCopy(score);

  return (
    <div className="paper-shell">
      <SocialPresence />
      <PublicHeader account={{ displayName: score.displayName }} />
      <main className="auth-layout">
        <section className="auth-aside">
          <p className="eyebrow">Session</p>
          <h1>{copy.title}</h1>
          <p>{copy.aside}</p>
        </section>
        <section className="auth-card" aria-label="Session">
          <h2>{copy.heading}</h2>
          <div className="session-result">
            {score.state === "finished" ? (
              <>
                <p className="score-points">{score.xp} XP</p>
                <p>{score.distracted ? "Distracted" : "Focused"}</p>
                <p>{formatDuration(score.durationSeconds)}</p>
                <p>
                  {score.blockedLabels.length > 0
                    ? score.blockedLabels.join(", ")
                    : "No blocked sites"}
                </p>
                <p>
                  <time dateTime={score.createdAt}>{formatTimestamp(score.createdAt)}</time>
                </p>
              </>
            ) : (
              <p>{copy.detail}</p>
            )}
            <Link href="/dashboard" className="button">
              Back to the desk
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function sessionCopy(score: LoadedStudyScore) {
  if (score.state === "finished") {
    return {
      title: score.distracted ? "That session still counts." : "That focus is saved.",
      aside: "The experience is on your pet. The desk is ready for the next session.",
      heading: "Experience",
      detail: "",
    };
  }
  if (score.state === "pending") {
    return {
      title: "This session is still running.",
      aside: "Finish it from the pet or the desk timer. This page fills in after the score is saved.",
      heading: "Still running",
      detail: "This session is still running.",
    };
  }
  if (score.state === "cancelled") {
    return {
      title: "This session was stopped.",
      aside: "Nothing from it was added to your pet.",
      heading: "Stopped",
      detail: "This session was stopped.",
    };
  }
  return {
    title: "That session could not be found.",
    aside: "It may belong to another account, or the link is no longer valid.",
    heading: "Not found",
    detail: "That session could not be found.",
  };
}
