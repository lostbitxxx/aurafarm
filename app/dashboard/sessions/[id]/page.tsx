import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { loadStudyScore } from "@/lib/study-score";
import { formatDuration, formatTimestamp } from "@/lib/study";

export const metadata: Metadata = {
  title: "Score",
};

export default async function StudyScorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const score = await loadStudyScore(id);

  return (
    <>
      <SiteHeader displayName={score.displayName} />
      <main className="score-layout">
        <section className="panel study-panel" aria-label="Score">
          <div className="inventory-heading">
            <h2>Score</h2>
          </div>
          {score.state === "scored" ? (
            <>
              <p className="score-points">{score.points}</p>
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
          {score.state === "pending" ? <p>The pet has not submitted this session yet.</p> : null}
          {score.state === "cancelled" ? <p>This session was stopped before it was scored.</p> : null}
          {score.state === "missing" ? <p>That score could not be found.</p> : null}
          <p>
            <Link href="/dashboard">Back to the desk</Link>
          </p>
        </section>
      </main>
    </>
  );
}
