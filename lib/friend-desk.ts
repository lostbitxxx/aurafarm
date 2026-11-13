import "server-only";
import { connection } from "next/server";
import {
  friendCardsFromRows,
  friendRequestMessage,
  isFriendInvite,
  isStatusSeen,
  type FriendCard,
  type FriendInvite,
  type StatusSeen,
} from "./friends";
import { touchSocialPresence } from "./actions/friends";
import { createClient } from "./supabase/server";

export async function loadFriendDesk() {
  await connection();
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (claimsError || !userId) {
    return {
      friendCode: "",
      friendInvite: "manual" as FriendInvite,
      allowStatusSeen: "friend_only" as StatusSeen,
      friends: [] as FriendCard[],
      friendsError: "Sign in to see friends.",
    };
  }

  const [profileResult, listResult] = await Promise.all([
    supabase
      .from("social_profile")
      .select("friend_code, friend_invite, allow_status_seen")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.rpc("list_friends"),
  ]);

  const friends = Array.isArray(listResult.data) ? friendCardsFromRows(listResult.data) : [];
  const rawError = profileResult.error?.message ?? listResult.error?.message ?? "";
  const presence = await touchSocialPresence(true);

  return {
    friendCode: typeof profileResult.data?.friend_code === "string" ? profileResult.data.friend_code : "",
    friendInvite: isFriendInvite(profileResult.data?.friend_invite)
      ? profileResult.data.friend_invite
      : "manual",
    allowStatusSeen: isStatusSeen(profileResult.data?.allow_status_seen)
      ? profileResult.data.allow_status_seen
      : "friend_only",
    friends,
    friendsError:
      profileResult.error || listResult.error
        ? friendRequestMessage(rawError)
        : presence.error || null,
  };
}
