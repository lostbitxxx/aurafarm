"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { refreshFarmCrewRoom } from "@/lib/actions/farm-crew";
import { loadFarmCrewLeaderboard } from "@/lib/actions/leaderboard";
import { managesFarmCrew, type FarmCrewRoom } from "@/lib/farm-crew";
import type { LeaderboardMode, LeaderboardRow } from "@/lib/leaderboard";
import { CrewAdminDialog } from "./crew-admin-dialog";
import { HeaderMenu } from "./header-menu";
import { CrewRoom } from "./crew-room";
import { FarmDialog } from "./farm-dialog";
import { LeaderboardPanel } from "./leaderboard-dialog";
import { PixelPetArt } from "./pixel-pet";
import { SocialPresence } from "./social-presence";

export function FarmCrewScreen({ room }: { room: FarmCrewRoom }) {
  const [detail, setDetail] = useState(room.crew);
  const [occupants, setOccupants] = useState(room.occupants);
  const [error, setError] = useState(room.error);
  const [panel, setPanel] = useState<"board" | "admin" | null>(null);

  useEffect(() => {
    if (!room.crew) return;
    let stopped = false;
    async function load() {
      const result = await refreshFarmCrewRoom(room.crew!.crewId);
      if (stopped) return;
      if (result.error || !result.crew) {
        setError(result.error || "This FarmCrew is not open to you.");
        return;
      }
      setDetail(result.crew);
      setOccupants(result.occupants);
      setError(null);
    }
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
    <div className="desk-page">
      <SocialPresence />
      <header className="topbar">
        <div className="topbar-nav">
          <span className="wordmark">AuraFarmCrew</span>
          <div className="topbar-desktop-links">
            <Link href="/dashboard" className="topbar-link">
              Back to Dashboard
            </Link>
            {detail ? (
              <button type="button" className="topbar-link" onClick={() => setPanel("board")}>
                Leaderboard
              </button>
            ) : null}
            {detail && managesFarmCrew(detail.role) ? (
              <button type="button" className="topbar-link" onClick={() => setPanel("admin")}>
                Admin
              </button>
            ) : null}
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
            {detail ? (
              <button type="button" className="topbar-drawer-link" onClick={() => setPanel("board")}>
                Leaderboard
              </button>
            ) : null}
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
          <section className="living-room-block" aria-label={detail.name}>
            <div className="room-head crew-room-head">
              <PixelPetArt petType={detail.petType} color={detail.color} className="dialog-pet-art" alt="" />
              <div>
                <h1 className="room-title">{detail.name}</h1>
                <p className="room-subtitle">
                  {detail.memberCount} {detail.memberCount === 1 ? "member" : "members"} · {here} here now
                </p>
                {detail.description ? <p className="panel-hint">{detail.description}</p> : null}
              </div>
            </div>
            <CrewRoom occupants={occupants} />
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
