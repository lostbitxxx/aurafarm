import { sampleClothes, sampleColor, sampleHat } from "./pet-assets";

export const FRIEND_CODE_PATTERN = /^[ABCDEFGHIJKLMNPQRSTUVWXYZ23456789]{8}$/;

export type FriendCard = {
  friendId: string;
  displayName: string;
  status: "pending" | "accepted";
  incoming: boolean;
  petType: string | null;
  color: string | null;
  hat: string | null;
  clothes: string | null;
};

const FRIEND_MIGRATION = "Run migration 0025 before adding friends.";

export function normalizeFriendCode(value: string) {
  return value.trim().toUpperCase();
}

export function friendRequestMessage(message: string) {
  if (/your friend code/i.test(message)) return "That is your friend code.";
  if (/already friends/i.test(message)) return "You are already friends.";
  if (/already sent/i.test(message)) return "You already sent that request.";
  if (/requests are closed/i.test(message)) return "That farmer is not taking friend requests.";
  if (/unknown friend code/i.test(message)) return "No farmer uses that code.";
  if (/no friend request to accept/i.test(message)) return "That request is no longer waiting.";
  if (/no friend request to decline/i.test(message)) return "That request is no longer waiting.";
  if (/social_profile|friendship|list_friends|schema cache/i.test(message)) return FRIEND_MIGRATION;
  return message;
}

export function acceptedFriends(rows: readonly FriendCard[]) {
  return rows.filter((row) => row.status === "accepted");
}

export function incomingFriendRequests(rows: readonly FriendCard[]) {
  return rows.filter((row) => row.status === "pending" && row.incoming);
}

type FriendRpcRow = {
  friend_id?: unknown;
  display_name?: unknown;
  status?: unknown;
  incoming?: unknown;
  pet_type?: unknown;
  color?: unknown;
  hat?: unknown;
  clothes?: unknown;
};

export function friendCardsFromRows(rows: readonly FriendRpcRow[]) {
  return rows.flatMap((row) => {
    const card = friendCard(row);
    return card ? [card] : [];
  });
}

function friendCard(row: FriendRpcRow): FriendCard | null {
  const friendId = typeof row.friend_id === "string" ? row.friend_id : "";
  const status = row.status === "accepted" || row.status === "pending" ? row.status : null;
  if (!friendId || !status) return null;
  const petType = typeof row.pet_type === "string" && row.pet_type.trim() ? row.pet_type : null;
  return {
    friendId,
    displayName:
      typeof row.display_name === "string" && row.display_name.trim()
        ? row.display_name.trim()
        : "Farmer",
    status,
    incoming: row.incoming === true,
    petType,
    color: sampleColor(row.color),
    hat: sampleHat(row.hat),
    clothes: sampleClothes(row.clothes),
  };
}
