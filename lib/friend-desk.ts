import "server-only";
import { connection } from "next/server";
import { friendCardsFromRows, friendRequestMessage, type FriendCard } from "./friends";
import { createClient } from "./supabase/server";

export async function loadFriendDesk() {
  await connection();
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (claimsError || !userId) {
    return { friendCode: "", friends: [] as FriendCard[], friendsError: "Sign in to see friends." };
  }

  const [profileResult, listResult] = await Promise.all([
    supabase.from("social_profile").select("friend_code").eq("user_id", userId).maybeSingle(),
    supabase.rpc("list_friends"),
  ]);

  const friends = Array.isArray(listResult.data) ? friendCardsFromRows(listResult.data) : [];
  const rawError = profileResult.error?.message ?? listResult.error?.message ?? "";

  return {
    friendCode: typeof profileResult.data?.friend_code === "string" ? profileResult.data.friend_code : "",
    friends,
    friendsError: profileResult.error || listResult.error ? friendRequestMessage(rawError) : null,
  };
}
