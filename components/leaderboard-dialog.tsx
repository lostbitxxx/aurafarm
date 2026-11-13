"use client";

import { useEffect, useState } from "react";
import { loadFriendLeaderboard } from "@/lib/actions/leaderboard";
import {
  LEADERBOARD_MODES,
  formatLeaderboardScore,
  isLeaderboardMode,
  leaderboardValueLabel,
  type LeaderboardMode,
  type LeaderboardRow,
} from "@/lib/leaderboard";
import { FarmDialog } from "./farm-dialog";

export function LeaderboardDialog({
  userId,
  onClose,
}: {
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
    void loadFriendLeaderboard(mode).then((result) => {
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
  }, [mode]);

  return (
    <FarmDialog title="Leaderboard" onClose={onClose} wide>
      <label className="field">
        Leaderboard
        <select
          value={mode}
          aria-label="Leaderboard mode"
          onChange={(event) => {
            if (isLeaderboardMode(event.target.value)) setMode(event.target.value);
          }}
        >
          {LEADERBOARD_MODES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="panel-hint">Loading the board…</p> : null}
      {!loading && !error && rows.length === 0 ? <p className="panel-hint">No farmers to rank.</p> : null}
      {!loading && rows.length > 0 ? (
        <table className="leaderboard-grid">
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Farmer</th>
              <th scope="col">{leaderboardValueLabel(mode)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.farmerId} className={row.farmerId === userId ? "is-you" : undefined}>
                <td>{row.place}</td>
                <td>{row.farmerId === userId ? `${row.displayName} (you)` : row.displayName}</td>
                <td>{formatLeaderboardScore(mode, row.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </FarmDialog>
  );
}
