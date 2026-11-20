"use server";

import { revalidatePath } from "next/cache";
import { ROOM_DECOR_CATEGORIES, roomSkinPrice, type RoomDecorCategoryId } from "@/lib/room-decor";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const CATEGORY_IDS = new Set(ROOM_DECOR_CATEGORIES.map((category) => category.id));

export async function buyRoomSkin(categoryId: string, skinId: string) {
  if (!CATEGORY_IDS.has(categoryId as RoomDecorCategoryId) || typeof skinId !== "string" || !skinId) {
    return { error: "That skin could not be bought.", coins: null as number | null };
  }
  if (skinId === "base") {
    return { error: "Base skins are already owned.", coins: null as number | null };
  }
  if (categoryId === "trim") {
    return { error: "Trim skins come with the matching wall.", coins: null as number | null };
  }
  if (roomSkinPrice(categoryId as RoomDecorCategoryId, skinId) == null) {
    return { error: "That skin is not for sale.", coins: null as number | null };
  }
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured.", coins: null as number | null };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (claimsError || !userId) {
    return { error: "Sign in to buy a skin.", coins: null as number | null };
  }

  const { error } = await supabase.rpc("purchase_room_skin", {
    target_category: categoryId,
    target_skin: skinId,
  });
  if (error) {
    if (/already owned/i.test(error.message)) {
      return { error: "You already own that skin.", coins: null as number | null };
    }
    if (/not for sale|not authenticated|base skins/i.test(error.message)) {
      return { error: error.message.replace(/^.*?: /, ""), coins: null as number | null };
    }
    if (/not enough coins/i.test(error.message)) {
      return { error: "Not enough coins.", coins: null as number | null };
    }
    if (/trim skins come with/i.test(error.message)) {
      return { error: "Trim skins come with the matching wall.", coins: null as number | null };
    }
    return { error: error.message, coins: null as number | null };
  }

  const coinsResult = await supabase.from("profiles").select("coins").eq("id", userId).maybeSingle();
  const coins =
    coinsResult.data && Number.isFinite(Number(coinsResult.data.coins))
      ? Math.max(0, Math.trunc(Number(coinsResult.data.coins)))
      : null;

  revalidatePath("/dashboard");
  return { error: "", coins };
}
