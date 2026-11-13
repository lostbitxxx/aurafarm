"use server";

import { revalidatePath } from "next/cache";
import { FRIEND_CODE_PATTERN, friendRequestMessage, normalizeFriendCode } from "@/lib/friends";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const userIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function signedInClient() {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) {
    return { error: "Sign in to add a friend." };
  }
  return { supabase };
}

export async function sendFriendRequest(friendCode: string) {
  const code = normalizeFriendCode(friendCode);
  if (!FRIEND_CODE_PATTERN.test(code)) {
    return { error: "Enter a friend code." };
  }

  const client = await signedInClient();
  if ("error" in client) return client;

  const { error } = await client.supabase.rpc("send_friend_request", { target_code: code });
  if (error) return { error: friendRequestMessage(error.message) };

  revalidatePath("/dashboard");
  return { error: "" };
}

export async function acceptFriend(friendId: string) {
  if (!userIdPattern.test(friendId)) {
    return { error: "That request is no longer waiting." };
  }

  const client = await signedInClient();
  if ("error" in client) return client;

  const { error } = await client.supabase.rpc("accept_friend", { target_user: friendId });
  if (error) return { error: friendRequestMessage(error.message) };

  revalidatePath("/dashboard");
  return { error: "" };
}

export async function declineFriend(friendId: string) {
  if (!userIdPattern.test(friendId)) {
    return { error: "That request is no longer waiting." };
  }

  const client = await signedInClient();
  if ("error" in client) return client;

  const { error } = await client.supabase.rpc("decline_friend", { target_user: friendId });
  if (error) return { error: friendRequestMessage(error.message) };

  revalidatePath("/dashboard");
  return { error: "" };
}
