"use client";

import { useState } from "react";
import type { FriendCard, FriendInvite, StatusSeen } from "@/lib/friends";
import { FarmDialog } from "./farm-dialog";
import { FriendsDialog } from "./friends-dialog";
import { FarmCrewDialog } from "./farm-crew-dialog";
import { LeaderboardDialog } from "./leaderboard-dialog";
import { SocialSettingsDialog } from "./social-settings-dialog";

export type SocialBoardTab = "friends" | "farmcrew" | "leaderboard" | "social-settings";

const TABS: readonly { id: SocialBoardTab; label: string }[] = [
  { id: "friends", label: "Friends" },
  { id: "farmcrew", label: "FarmCrew" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "social-settings", label: "Social settings" },
];

export function SocialBoardDialog({
  friends,
  friendCode,
  friendsError,
  friendInvite,
  allowStatusSeen,
  showPetNames,
  userId,
  pendingFriendRequest = false,
  onFriendsChange,
  onShowPetNamesChange,
  onClose,
}: {
  friends: readonly FriendCard[];
  friendCode: string;
  friendsError: string | null;
  friendInvite: FriendInvite;
  allowStatusSeen: StatusSeen;
  showPetNames: boolean;
  userId: string;
  pendingFriendRequest?: boolean;
  onFriendsChange?: (friends: readonly FriendCard[]) => void;
  onShowPetNamesChange?: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SocialBoardTab>("friends");

  return (
    <FarmDialog title="Blackboard" onClose={onClose} wide>
      <div className="social-board-tabs" role="tablist" aria-label="Blackboard">
        {TABS.map((item) => {
          const selected = tab === item.id;
          const friendsAlert = item.id === "friends" && pendingFriendRequest;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`social-board-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`social-board-panel-${item.id}`}
              className={selected ? "social-board-tab is-active" : "social-board-tab"}
              aria-label={friendsAlert ? "Friends, pending request" : undefined}
              onClick={() => setTab(item.id)}
            >
              <span>{item.label}</span>
              {friendsAlert ? <span className="request-dot" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <div
        className="social-board-body"
        role="tabpanel"
        id={`social-board-panel-${tab}`}
        aria-labelledby={`social-board-tab-${tab}`}
      >
        {tab === "friends" ? (
          <FriendsDialog
            embedded
            friends={friends}
            friendCode={friendCode}
            friendsError={friendsError}
            onFriendsChange={onFriendsChange}
            onClose={onClose}
          />
        ) : null}
        {tab === "farmcrew" ? <FarmCrewDialog embedded onClose={onClose} /> : null}
        {tab === "leaderboard" ? <LeaderboardDialog embedded userId={userId} onClose={onClose} /> : null}
        {tab === "social-settings" ? (
          <SocialSettingsDialog
            embedded
            friendCode={friendCode}
            friendInvite={friendInvite}
            allowStatusSeen={allowStatusSeen}
            showPetNames={showPetNames}
            friendsError={friendsError}
            onShowPetNamesChange={onShowPetNamesChange}
            onClose={onClose}
          />
        ) : null}
      </div>
    </FarmDialog>
  );
}
