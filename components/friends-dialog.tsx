"use client";

import { useEffect, useState, type FormEvent } from "react";
import { acceptFriend, declineFriend, refreshFriendList, sendFriendRequest } from "@/lib/actions/friends";
import { acceptedFriends, incomingFriendRequests, socialStatusLabel, type FriendCard } from "@/lib/friends";
import { FarmDialog } from "./farm-dialog";
import { PixelPetArt } from "./pixel-pet";

type FriendsTab = "list" | "add";

export function FriendsDialog({
  friends,
  friendCode,
  friendsError,
  onFriendsChange,
  onClose,
}: {
  friends: readonly FriendCard[];
  friendCode: string;
  friendsError: string | null;
  onFriendsChange?: (friends: readonly FriendCard[]) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<FriendsTab>("list");
  const [rows, setRows] = useState(friends);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(friendsError);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const signature = friends
    .map((friend) => `${friend.friendId}:${friend.status}:${friend.incoming}:${friend.presence}:${friend.petType ?? ""}`)
    .join("|");
  const [snap, setSnap] = useState(signature);
  const [errorSnap, setErrorSnap] = useState(friendsError);

  if (signature !== snap) {
    setSnap(signature);
    setRows(friends);
  }
  if (friendsError !== errorSnap) {
    setErrorSnap(friendsError);
    setError(friendsError);
  }

  const accepted = acceptedFriends(rows);
  const incoming = incomingFriendRequests(rows);
  const pendingRequest = incoming.length > 0;

  useEffect(() => {
    onFriendsChange?.(rows);
  }, [rows, onFriendsChange]);

  async function loadFriends() {
    const result = await refreshFriendList();
    if (result.error) {
      setError(result.error);
      return;
    }
    setRows(result.friends);
  }

  function openFriendList() {
    setTab("list");
    void loadFriends();
  }

  useEffect(() => {
    let stopped = false;
    async function load() {
      const result = await refreshFriendList();
      if (stopped) return;
      if (result.error) setError(result.error);
      else setRows(result.friends);
    }
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 10_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

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

  async function onSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending("send");
    setError(null);
    setNotice(null);
    const result = await sendFriendRequest(code);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCode("");
    setNotice("Request sent.");
  }

  async function onAccept(friendId: string) {
    if (pending) return;
    const previous = rows;
    setRows((current) =>
      current.map((friend) =>
        friend.friendId === friendId ? { ...friend, status: "accepted", incoming: false } : friend,
      ),
    );
    setError(null);
    setPending(friendId);
    const result = await acceptFriend(friendId);
    setPending(null);
    if (result.error) {
      setRows(previous);
      setError(result.error);
    }
  }

  async function onDecline(friendId: string) {
    if (pending) return;
    const previous = rows;
    setRows((current) => current.filter((friend) => friend.friendId !== friendId));
    setError(null);
    setPending(friendId);
    const result = await declineFriend(friendId);
    setPending(null);
    if (result.error) {
      setRows(previous);
      setError(result.error);
    }
  }

  return (
    <FarmDialog title="Friends" onClose={onClose} wide>
      <div className="collection-tabs" role="tablist" aria-label="Friends">
        <button
          type="button"
          role="tab"
          id="friends-tab-list"
          aria-selected={tab === "list"}
          aria-controls="friends-panel-list"
          className={tab === "list" ? "button button-small" : "button button-small button-ghost"}
          onClick={openFriendList}
        >
          Friend List
        </button>
        <button
          type="button"
          role="tab"
          id="friends-tab-add"
          aria-selected={tab === "add"}
          aria-controls="friends-panel-add"
          className={
            tab === "add" ? "button button-small request-tab" : "button button-small button-ghost request-tab"
          }
          aria-label={pendingRequest ? "Add Friends, pending request" : undefined}
          onClick={() => setTab("add")}
        >
          Add Friends
          {pendingRequest ? <span className="request-dot" aria-hidden="true" /> : null}
        </button>
      </div>
      <div
        className="collection-panel friends-panel"
        role="tabpanel"
        id={tab === "list" ? "friends-panel-list" : "friends-panel-add"}
        aria-labelledby={tab === "list" ? "friends-tab-list" : "friends-tab-add"}
      >
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {tab === "list" ? (
          accepted.length > 0 ? (
            <ul className="dialog-list">
              {accepted.map((friend) => (
                <li key={friend.friendId} className="dialog-row">
                  <FriendAppearance friend={friend} />
                  <div>
                    <strong>{friend.displayName}</strong>
                    <span className={`friend-presence friend-presence-${friend.presence}`}>
                      {socialStatusLabel(friend.presence)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-hint">No friends yet.</p>
          )
        ) : (
          <>
            <div className="friend-code-row">
              <p className="panel-hint">
                Your friend code <strong className="friend-code">{friendCode || "Unavailable"}</strong>
              </p>
              <button type="button" className="button button-small" onClick={onCopy} disabled={!friendCode}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <form className="friend-add-form" onSubmit={onSend}>
              <label className="field friend-code-field">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  aria-label="Friend code"
                  placeholder="Friend code"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={12}
                />
              </label>
              <button type="submit" className="button button-small" disabled={pending !== null}>
                Send Request
              </button>
            </form>
            {notice ? <p className="panel-hint">{notice}</p> : null}
            {incoming.length > 0 ? (
              <ul className="dialog-list">
                {incoming.map((friend) => (
                  <li key={friend.friendId} className="dialog-row">
                    <FriendAppearance friend={friend} />
                    <strong>{friend.displayName}</strong>
                    <div className="dialog-row-actions">
                      <button
                        type="button"
                        className="button button-small button-accept"
                        disabled={pending !== null}
                        onClick={() => onAccept(friend.friendId)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="button button-small button-decline"
                        disabled={pending !== null}
                        onClick={() => onDecline(friend.friendId)}
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-hint">No incoming requests.</p>
            )}
          </>
        )}
      </div>
    </FarmDialog>
  );
}

function FriendAppearance({ friend }: { friend: FriendCard }) {
  if (!friend.petType) {
    return <span className="dialog-pet-art friend-pet-missing" aria-hidden="true" />;
  }
  return (
    <PixelPetArt
      petType={friend.petType}
      color={friend.color}
      hat={friend.hat}
      clothes={friend.clothes}
      className="dialog-pet-art"
      alt=""
    />
  );
}
