"use client";

import { useState, type FormEvent } from "react";
import { acceptFriend, declineFriend, sendFriendRequest } from "@/lib/actions/friends";
import { acceptedFriends, incomingFriendRequests, type FriendCard } from "@/lib/friends";
import { FarmDialog } from "./farm-dialog";
import { PixelPetArt } from "./pixel-pet";

type FriendsTab = "list" | "add";

export function FriendsDialog({
  friendCode,
  friends,
  friendsError,
  onClose,
}: {
  friendCode: string;
  friends: readonly FriendCard[];
  friendsError: string | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<FriendsTab>("list");
  const [rows, setRows] = useState(friends);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(friendsError);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const signature = friends
    .map((friend) => `${friend.friendId}:${friend.status}:${friend.incoming}:${friend.petType ?? ""}`)
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
          onClick={() => setTab("list")}
        >
          Friend List
        </button>
        <button
          type="button"
          role="tab"
          id="friends-tab-add"
          aria-selected={tab === "add"}
          aria-controls="friends-panel-add"
          className={tab === "add" ? "button button-small" : "button button-small button-ghost"}
          onClick={() => setTab("add")}
        >
          Add Friends
        </button>
      </div>
      <div
        className="collection-panel"
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
                  <strong>{friend.displayName}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-hint">No friends yet.</p>
          )
        ) : (
          <>
            {friendCode ? (
              <p className="panel-hint">
                Your friend code <strong className="friend-code">{friendCode}</strong>
              </p>
            ) : null}
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
