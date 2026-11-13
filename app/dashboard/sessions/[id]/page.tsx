import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SocialPresence } from "@/components/social-presence";
import { loadStudyScore } from "@/lib/study-score";
import { formatDuration, formatTimestamp } from "@/lib/study";

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

  return (
    <>
      <SocialPresence />
      <SiteHeader displayName={score.displayName} />
      <main className="score-layout">
        <section className="study-panel" aria-label="Session">
          <div className="inventory-heading">
            <h2>Experience</h2>
          </div>
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
          ) : null}
          {score.state === "pending" ? <p>This session is still running.</p> : null}
          {score.state === "cancelled" ? <p>This session was stopped.</p> : null}
          {score.state === "missing" ? <p>That session could not be found.</p> : null}
          <p>
            <Link href="/dashboard">Back to the desk</Link>
          </p>
        </section>
      </main>
    </>
  );
}
