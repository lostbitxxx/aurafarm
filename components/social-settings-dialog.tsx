"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { updateSocialSettings } from "@/lib/actions/friends";
import {
  FRIEND_INVITE_OPTIONS,
  STATUS_SEEN_OPTIONS,
  isFriendInvite,
  isStatusSeen,
  type FriendInvite,
  type StatusSeen,
} from "@/lib/friends";
import { FarmDialog } from "./farm-dialog";

type PickerOption = { id: string; label: string };

export function SocialSettingsDialog({
  friendCode,
  friendInvite,
  allowStatusSeen,
  friendsError,
  onClose,
}: {
  friendCode: string;
  friendInvite: FriendInvite;
  allowStatusSeen: StatusSeen;
  friendsError: string | null;
  onClose: () => void;
}) {
  const [invite, setInvite] = useState(friendInvite);
  const [seen, setSeen] = useState(allowStatusSeen);
  const [error, setError] = useState<string | null>(friendsError);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openPicker, setOpenPicker] = useState<"invite" | "seen" | null>(null);
  const settingsKey = `${friendInvite}|${allowStatusSeen}|${friendsError ?? ""}`;
  const [snap, setSnap] = useState(settingsKey);

  if (settingsKey !== snap) {
    setSnap(settingsKey);
    setInvite(friendInvite);
    setSeen(allowStatusSeen);
    setError(friendsError);
  }

  async function onCopy() {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
      setCopied(true);
    } catch {
      setCopied(false);
      setError("The code could not be copied.");
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !isFriendInvite(invite) || !isStatusSeen(seen)) return;
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await updateSocialSettings(invite, seen);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNotice("Saved.");
  }

  return (
    <FarmDialog title="Social Settings" onClose={onClose} wide>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="friend-code-row">
        <p className="panel-hint">
          Your friend code <strong className="friend-code">{friendCode || "Unavailable"}</strong>
        </p>
        <button type="button" className="button button-small" onClick={onCopy} disabled={!friendCode}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <form className="social-settings-form" onSubmit={onSave}>
        <SettingPicker
          label="Who can add you"
          value={invite}
          options={FRIEND_INVITE_OPTIONS}
          open={openPicker === "invite"}
          onOpenChange={(open) => setOpenPicker(open ? "invite" : null)}
          onChange={(value) => {
            if (isFriendInvite(value)) setInvite(value);
          }}
          mark={inviteMark}
        />
        <SettingPicker
          label="Who can see your status"
          value={seen}
          options={STATUS_SEEN_OPTIONS}
          open={openPicker === "seen"}
          onOpenChange={(open) => setOpenPicker(open ? "seen" : null)}
          onChange={(value) => {
            if (isStatusSeen(value)) setSeen(value);
          }}
          mark={seenMark}
        />
        <button type="submit" className="button button-small" disabled={pending}>
          Save
        </button>
      </form>
      {notice ? <p className="panel-hint">{notice}</p> : null}
    </FarmDialog>
  );
}

function SettingPicker({
  label,
  value,
  options,
  open,
  onOpenChange,
  onChange,
  mark,
}: {
  label: string;
  value: string;
  options: readonly PickerOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  mark: (id: string) => ReactNode;
}) {
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = options.find((option) => option.id === value) ?? options[0];

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
      onOpenChange(false);
    }
    function onEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape, true);
    };
  }, [open, onOpenChange]);

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
    const index = options.findIndex((option) => option.id === value);
    const next = options[(index + delta + options.length) % options.length];
    onChange(next.id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        onOpenChange(true);
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
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => onOpenChange(!open)}
      >
        <span>
          <span className="board-picker-kicker">{label}</span>
          <strong>{current.label}</strong>
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
              aria-label={label}
              style={box ? { top: box.top, left: box.left, width: box.width } : { visibility: "hidden" }}
              onKeyDown={onKeyDown}
            >
              {options.map((option) => {
                const selected = option.id === value;
                return (
                  <li key={option.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={selected ? "is-selected" : undefined}
                      onClick={() => {
                        onChange(option.id);
                        onOpenChange(false);
                      }}
                    >
                      {mark(option.id)}
                      <span>
                        <strong>{option.label}</strong>
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

function inviteMark(id: string) {
  if (id === "manual") {
    return (
      <svg className="board-picker-mark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 12.5 10.2 16 17 8" />
        <circle cx="12" cy="12" r="8" />
      </svg>
    );
  }
  if (id === "disabled") {
    return (
      <svg className="board-picker-mark" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M7.5 7.5 16.5 16.5" />
      </svg>
    );
  }
  return (
    <svg className="board-picker-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16.5 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M3.5 18.5c.6-2.4 2.4-3.7 4.5-3.7s3.9 1.3 4.5 3.7M14 15.2c1.4-.3 2.8.2 3.8 1.6" />
    </svg>
  );
}

function seenMark(id: string) {
  if (id === "friend_only") {
    return (
      <svg className="board-picker-mark" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="9" r="3" />
        <path d="M6.5 18.5c.7-2.6 2.7-4 5.5-4s4.8 1.4 5.5 4" />
      </svg>
    );
  }
  if (id === "group_only") {
    return (
      <svg className="board-picker-mark" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="8" cy="9" r="2.3" />
        <circle cx="16" cy="9" r="2.3" />
        <path d="M3.8 18c.5-2.2 2-3.3 4.2-3.3 2.1 0 3.6 1.1 4.2 3.3M12 15.2c.8-1.6 2.2-2.5 4-2.5 2 0 3.4 1 4.1 2.8" />
      </svg>
    );
  }
  if (id === "none") {
    return (
      <svg className="board-picker-mark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" />
        <circle cx="12" cy="12" r="2" />
        <path d="M6 18 18 6" />
      </svg>
    );
  }
  return (
    <svg className="board-picker-mark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="8.5" r="2.2" />
      <circle cx="15.5" cy="9" r="2.2" />
      <path d="M3.8 17.5c.5-2 1.9-3.1 3.9-3.1 1.6 0 2.9.7 3.6 1.8" />
      <path d="M13 14.8c.6-1.2 1.8-1.9 3.4-1.9 1.8 0 3.1.9 3.8 2.6" />
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
