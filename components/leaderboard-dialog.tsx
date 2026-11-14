"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { loadFriendLeaderboard, loadGlobalLeaderboard } from "@/lib/actions/leaderboard";
import {
  LEADERBOARD_MODES,
  LEADERBOARD_SCOPES,
  formatLeaderboardScore,
  leaderboardValueLabel,
  type LeaderboardMode,
  type LeaderboardRow,
  type LeaderboardScope,
} from "@/lib/leaderboard";
import { FarmDialog } from "./farm-dialog";

export function LeaderboardDialog({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<LeaderboardScope>("friends");
  const [mode, setMode] = useState<LeaderboardMode>("all_time");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setRows([]);
    const load = scope === "global" ? loadGlobalLeaderboard(mode) : loadFriendLeaderboard(mode);
    void load.then((result) => {
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
  }, [mode, scope]);

  return (
    <FarmDialog
      title="Leaderboard"
      onClose={onClose}
      wide
      extra={<LeaderboardScopeSwitch scope={scope} onChange={setScope} />}
    >
      <LeaderboardModePicker mode={mode} onChange={setMode} />
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

function LeaderboardScopeSwitch({
  scope,
  onChange,
}: {
  scope: LeaderboardScope;
  onChange: (scope: LeaderboardScope) => void;
}) {
  return (
    <div className="board-scope" role="tablist" aria-label="Leaderboard scope">
      <span className={scope === "global" ? "board-scope-thumb is-global" : "board-scope-thumb"} aria-hidden="true" />
      {LEADERBOARD_SCOPES.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={scope === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function splitModeLabel(label: string) {
  const splitAt = label.indexOf(" - ");
  if (splitAt === -1) return { title: label, detail: "" };
  return { title: label.slice(0, splitAt), detail: label.slice(splitAt + 3) };
}

function LeaderboardModePicker({
  mode,
  onChange,
}: {
  mode: LeaderboardMode;
  onChange: (mode: LeaderboardMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = LEADERBOARD_MODES.find((option) => option.id === mode) ?? LEADERBOARD_MODES[0];
  const currentLabel = splitModeLabel(current.label);

  function placeMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = menuRef.current?.getBoundingClientRect().height ?? 0;
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const up = menuHeight > spaceBelow && spaceAbove > spaceBelow;
    const top = up ? Math.max(8, rect.top - gap - menuHeight) : rect.bottom + gap;
    setBox({ top, left: rect.left, width: rect.width });
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
    const frame = requestAnimationFrame(placeMenu);
    window.addEventListener("resize", placeMenu);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", placeMenu);
    };
  }, [open]);

  function step(delta: number) {
    const index = LEADERBOARD_MODES.findIndex((option) => option.id === mode);
    const next = LEADERBOARD_MODES[(index + delta + LEADERBOARD_MODES.length) % LEADERBOARD_MODES.length];
    onChange(next.id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      step(event.key === "ArrowDown" ? 1 : -1);
    }
  }

  return (
    <div className={open ? "board-picker is-open" : "board-picker"} ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={triggerRef}
        className="board-picker-trigger"
        aria-label="Leaderboard mode"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="board-picker-kicker">Rank by</span>
          <strong>{currentLabel.title}</strong>
          {currentLabel.detail ? <em>{currentLabel.detail}</em> : null}
        </span>
        <Chevron />
      </button>
      {open
        ? createPortal(
        <ul
          ref={menuRef}
          id={listId}
          className="board-picker-menu"
          role="listbox"
          aria-label="Leaderboard mode"
          style={box ? { top: box.top, left: box.left, width: box.width } : { visibility: "hidden" }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            triggerRef.current?.focus();
          }}
        >
          {LEADERBOARD_MODES.map((option) => {
            const label = splitModeLabel(option.label);
            const selected = option.id === mode;
            return (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-label={option.label}
                  aria-selected={selected}
                  className={selected ? "is-selected" : undefined}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <ModeMark mode={option.id} />
                  <span>
                    <strong>{label.detail || label.title}</strong>
                    {label.detail ? <em>{label.title}</em> : null}
                  </span>
                  {selected ? <Check /> : <span className="board-picker-check" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>,
        document.body,
      )
        : null}
    </div>
  );
}

function ModeMark({ mode }: { mode: LeaderboardMode }) {
  if (mode === "pet_levels") {
    return (
      <svg className="board-picker-mark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 6.5c-2.1 0-3.7 1.5-3.7 3.4 0 .4.1.7.2 1.1-1.5.7-2.5 2-2.5 3.6C6 17.6 8.5 19.5 12 19.5s6-1.9 6-4.9c0-1.6-1-2.9-2.5-3.6.1-.4.2-.7.2-1.1 0-1.9-1.6-3.4-3.7-3.4Z" />
        <circle cx="10.3" cy="14.6" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="13.7" cy="14.6" r="0.7" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (mode === "month") {
    return (
      <svg className="board-picker-mark" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5.5" width="16" height="14" rx="2" />
        <path d="M4 10h16M8 4v3M16 4v3" />
      </svg>
    );
  }
  if (mode === "week") {
    return (
      <svg className="board-picker-mark" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5.5" width="16" height="14" rx="2" />
        <path d="M4 10h16M9 14h2M13 14h2M9 17h2" />
      </svg>
    );
  }
  return (
    <svg className="board-picker-mark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 8v4.5l3 2" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg className="board-picker-chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9.5 12 15l6-5.5" />
    </svg>
  );
}

function Check() {
  return (
    <svg className="board-picker-check is-drawn" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 12.5 10 16.5 18 8" />
    </svg>
  );
}
