"use client";

import { useState, type FormEvent } from "react";
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
        <label className="field">
          Who can add you
          <select value={invite} onChange={(event) => setInvite(event.target.value as FriendInvite)}>
            {FRIEND_INVITE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Who can see your status
          <select value={seen} onChange={(event) => setSeen(event.target.value as StatusSeen)}>
            {STATUS_SEEN_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="button button-small" disabled={pending}>
          Save
        </button>
      </form>
      {notice ? <p className="panel-hint">{notice}</p> : null}
    </FarmDialog>
  );
}
