"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { refreshFarmCrewRoom } from "@/lib/actions/farm-crew";
import { completeStudyTimer, endStudyEarly } from "@/lib/actions/study";
import { farmerLocalDay, type ActiveStudySession } from "@/lib/study";
import { loadFarmCrewLeaderboard } from "@/lib/actions/leaderboard";
import { managesFarmCrew, type FarmCrewRoom } from "@/lib/farm-crew";
import type { LeaderboardMode, LeaderboardRow } from "@/lib/leaderboard";
import { CrewAdminDialog } from "./crew-admin-dialog";
import { HeaderMenu } from "./header-menu";
import { CrewRoom } from "./crew-room";
import { CrewStudyStart } from "./crew-study-start";
import { FarmDialog } from "./farm-dialog";
import { LeaderboardPanel } from "./leaderboard-dialog";
import { PixelPetArt } from "./pixel-pet";
import { SocialPresence } from "./social-presence";
import { StudyClock } from "./study-clock";

export function FarmCrewScreen({ room, downloadUrl = null }: { room: FarmCrewRoom; downloadUrl?: string | null }) {
  const [detail, setDetail] = useState(room.crew);
  const [occupants, setOccupants] = useState(room.occupants);
  const [error, setError] = useState(room.error);
  const [session, setSession] = useState(room.activeSession);
  const [launchUrl, setLaunchUrl] = useState("");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"board" | "admin" | null>(null);

  useEffect(() => {
    if (!room.crew) return;
    let stopped = false;
    let loading = false;
    async function load() {
      if (loading) return;
      loading = true;
      try {
        const result = await refreshFarmCrewRoom(room.crew!.crewId);
        if (stopped) return;
        if (result.error || !result.crew) {
          setError(result.error || "This FarmCrew is not open to you.");
          return;
        }
        setDetail(result.crew);
        setOccupants(result.occupants);
        setError(null);
      } finally {
        loading = false;
      }
    }
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 10_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [room.crew]);

  useEffect(() => {
    if (detail && !managesFarmCrew(detail.role)) {
      setPanel((current) => (current === "admin" ? null : current));
    }
  }, [detail]);

  const here = occupants.length;

  return (
    <div className="desk-page crew-desk">
      <SocialPresence />
      <header className="topbar">
        <div className="topbar-nav">
          <div className="topbar-brand">
            <span className="wordmark">AuraFarmCrew</span>
            <div className="topbar-desktop-links">
              <Link href="/dashboard" className="topbar-link">
                Back to Dashboard
              </Link>
              {detail && managesFarmCrew(detail.role) ? (
                <button type="button" className="topbar-link" onClick={() => setPanel("admin")}>
                  Admin
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="topbar-user">
          <span className="topbar-name" title={room.displayName}>
            {room.displayName}
          </span>
          <form action={signOut} className="topbar-desktop">
            <button type="submit" className="button button-small button-ghost">
              Sign out
            </button>
          </form>
          <HeaderMenu>
            <Link href="/dashboard" className="topbar-drawer-link">
              Back to Dashboard
            </Link>
            {detail && managesFarmCrew(detail.role) ? (
              <button type="button" className="topbar-drawer-link" onClick={() => setPanel("admin")}>
                Admin
              </button>
            ) : null}
            <form action={signOut}>
              <button type="submit" className="button button-small button-ghost">
                Sign out
              </button>
            </form>
          </HeaderMenu>
        </div>
      </header>
      <main className="crew-room-page">
        {detail && panel === "board" ? (
          <CrewLeaderboard crewId={detail.crewId} userId={room.userId} onClose={() => setPanel(null)} />
        ) : null}
        {detail && panel === "admin" && managesFarmCrew(detail.role) ? (
          <CrewAdminDialog
            crew={detail}
            viewerId={room.userId}
            onClose={() => setPanel(null)}
            onCrewChange={setDetail}
          />
        ) : null}
        {detail ? (
          <section className="living-room-block crew-room-stage" aria-label={detail.name}>
            <div className={session ? "crew-top is-studying" : "crew-top"}>
              <div className="room-head crew-room-head">
                {session ? (
                  <div>
                    <h1 className="room-title">Studying with you</h1>
                    <p className="room-subtitle">
                      {session.useDesktopPet
                        ? "Desktop pet is tracking this session."
                        : "Website timer is tracking this session."}
                    </p>
                  </div>
                ) : (
                  <>
                    <PixelPetArt petType={detail.petType} color={detail.color} className="dialog-pet-art" alt="" />
                    <div>
                      <h1 className="room-title">{detail.name}</h1>
                      <p className="room-subtitle">
                        {detail.memberCount} {detail.memberCount === 1 ? "member" : "members"} · {here} here now
                      </p>
                      {detail.description ? <p className="panel-hint">{detail.description}</p> : null}
                    </div>
                  </>
                )}
              </div>
              {session ? (
                <CrewSessionTimer
                  session={session}
                  launchUrl={launchUrl}
                  onFinished={async () => {
                    const result = await completeStudyTimer(session.id, "", farmerLocalDay());
                    if (!result.error) {
                      setSession(null);
                      setLaunchUrl("");
                    } else setSessionError(result.error);
                    return result;
                  }}
                  onEnded={() => {
                    setSession(null);
                    setLaunchUrl("");
                    setSessionError(null);
                  }}
                />
              ) : (
                <CrewStudyStart
                  downloadUrl={downloadUrl}
                  preferredSessionMinutes={room.preferredSessionMinutes}
                  streakCount={room.streakCount}
                  streakLocalDate={room.streakLocalDate}
                  onStarted={(next, url) => {
                    setSession(next);
                    setLaunchUrl(url);
                  }}
                />
              )}
            </div>
            {sessionError ? (
              <p className="form-error" role="alert">
                {sessionError}
              </p>
            ) : null}
            <CrewRoom
              crewId={detail.crewId}
              viewerId={room.userId}
              mascot={{ petType: detail.petType, color: detail.color }}
              occupants={occupants}
              viewerStudying={Boolean(session)}
              onOpenLeaderboard={() => setPanel("board")}
            />
          </section>
        ) : (
          <section className="living-room-block" aria-label="FarmCrew">
            <h1 className="room-title">FarmCrew</h1>
            <p className="form-error" role="alert">
              {error ?? "This FarmCrew is not open to you."}
            </p>
            <Link href="/dashboard" className="button">
              Back to Dashboard
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}

function CrewSessionTimer({
  session,
  launchUrl,
  onFinished,
  onEnded,
}: {
  session: ActiveStudySession;
  launchUrl: string;
  onFinished: () => Promise<{ error: string }>;
  onEnded: () => void;
}) {
  const [earlyOpen, setEarlyOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirmEarly() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await endStudyEarly(session.id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEarlyOpen(false);
    onEnded();
  }

  return (
    <>
      <div className="below-room crew-timer">
        <StudyClock
          session={session}
          rushed={false}
          onFinished={session.useDesktopPet ? null : onFinished}
        />
        <div className="desk-session-actions">
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className="button button-ghost button-end-early"
            disabled={pending}
            onClick={() => {
              setError(null);
              setEarlyOpen(true);
            }}
          >
            End session early
          </button>
          {launchUrl ? (
            <div className="scene-actions is-start">
              <a className="button button-start" href={launchUrl}>
                Open Aurafarm
              </a>
            </div>
          ) : null}
        </div>
      </div>
      {earlyOpen ? (
        <div className="tracker-pop" role="presentation" onClick={() => (pending ? null : setEarlyOpen(false))}>
          <div
            className="tracker-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="crew-early-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <h2 id="crew-early-title">End this session early?</h2>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setEarlyOpen(false)}
                aria-label="Close dialog"
                disabled={pending}
              >
                ×
              </button>
            </div>
            <p>
              The time you have already studied will be saved. Staying until the timer ends gives your pet a bigger
              bonus.
            </p>
            <p className="motivation-quote">A quiet minute still grows. The full session just grows your pet more.</p>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="tracker-actions">
              <button type="button" className="button button-ghost" disabled={pending} onClick={() => setEarlyOpen(false)}>
                Keep studying
              </button>
              <button type="button" className="button" disabled={pending} onClick={() => void onConfirmEarly()}>
                End session early
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CrewLeaderboard({
  crewId,
  userId,
  onClose,
}: {
  crewId: string;
  userId: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<LeaderboardMode>("all_time");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setRows([]);
    void loadFarmCrewLeaderboard(crewId, mode).then((result) => {
      if (stopped) return;
      setLoading(false);
      if (result.error) {
        setError(result.error);
        setRows([]);
        return;
      }
      setError(null);
      setRows(result.rows);
    });
    return () => {
      stopped = true;
    };
  }, [crewId, mode]);

  return (
    <FarmDialog title="Leaderboard" onClose={onClose} wide>
      <LeaderboardPanel
        userId={userId}
        mode={mode}
        onModeChange={setMode}
        rows={rows}
        error={error}
        loading={loading}
      />
    </FarmDialog>
  );
}
