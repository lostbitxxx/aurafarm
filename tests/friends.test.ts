import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  acceptedFriends,
  friendCardsFromRows,
  friendRequestMessage,
  incomingFriendRequests,
  normalizeFriendCode,
  type FriendCard,
} from "../lib/friends";

const ada: FriendCard = {
  friendId: "11111111-1111-4111-8111-111111111111",
  displayName: "Ada",
  status: "accepted",
  incoming: false,
  petType: "baby_slime",
  color: "sage",
  hat: "hat_a",
  clothes: null,
};

const grace: FriendCard = {
  friendId: "22222222-2222-4222-8222-222222222222",
  displayName: "Grace",
  status: "pending",
  incoming: true,
  petType: "lantern_moth",
  color: "lavender",
  hat: null,
  clothes: "clothes_a",
};

test("friend rows keep accepted friends apart from incoming requests", () => {
  assert.equal(normalizeFriendCode("  ab23mn7q "), "AB23MN7Q");
  assert.equal(friendRequestMessage("Unknown friend code"), "No farmer uses that code.");
  assert.equal(friendRequestMessage("Friend requests are closed"), "That farmer is not taking friend requests.");
  assert.deepEqual(acceptedFriends([ada, grace]), [ada]);
  assert.deepEqual(incomingFriendRequests([ada, grace]), [grace]);
  assert.deepEqual(incomingFriendRequests([{ ...grace, incoming: false }]), []);
  assert.deepEqual(
    friendCardsFromRows([
      {
        friend_id: ada.friendId,
        display_name: "  Ada ",
        status: "accepted",
        incoming: false,
        pet_type: "baby_slime",
        color: "sage",
        hat: "hat_a",
        clothes: "nope",
      },
      { friend_id: "", status: "accepted" },
    ]),
    [{ ...ada, clothes: null }],
  );
});

test("the desk opens Friends from Social and Leaderboard does nothing", () => {
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  const desk = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  const dialog = readFileSync(new URL("../components/friends-dialog.tsx", import.meta.url), "utf8");
  const action = readFileSync(new URL("../lib/actions/friends.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");

  assert.match(header, /Social/);
  assert.match(header, /onClick=\{onOpenFriends\}/);
  assert.match(header, />\s*Friends\s*</);
  assert.match(header, />\s*Leaderboard\s*</);
  assert.doesNotMatch(header, /Leaderboard[\s\S]*onClick/);
  assert.match(desk, /onOpenFriends=\{\(\) => setDialog\("friends"\)\}/);
  assert.match(desk, /<FriendsDialog/);
  assert.match(page, /loadFriendDesk/);

  assert.match(dialog, /Friend List/);
  assert.match(dialog, /Add Friends/);
  assert.match(dialog, /Send Request/);
  assert.match(dialog, /button-accept/);
  assert.match(dialog, /Accept/);
  assert.match(dialog, /button-decline/);
  assert.match(dialog, /Decline/);
  assert.match(dialog, /sendFriendRequest/);
  assert.match(dialog, /acceptFriend/);
  assert.match(dialog, /declineFriend/);
  assert.match(dialog, /friend\.displayName/);
  assert.match(dialog, /PixelPetArt/);

  assert.match(action, /send_friend_request/);
  assert.match(action, /accept_friend/);
  assert.match(action, /decline_friend/);
  assert.match(action, /revalidatePath\("\/dashboard"\)/);
});

test("friendship migration stores codes, invite mode, and acceptance time", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0025_friendship.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /create table if not exists public\.social_profile/);
  assert.match(sql, /friend_code text not null unique/);
  assert.match(sql, /friend_invite text not null default 'manual'/);
  assert.match(sql, /friend_invite in \('open', 'manual', 'disabled'\)/);
  assert.match(sql, /create table if not exists public\.friendship/);
  assert.match(sql, /status in \('pending', 'accepted'\)/);
  assert.match(sql, /created_at timestamptz not null default now\(\)/);
  assert.match(sql, /befriend_at timestamptz/);
  assert.match(sql, /status = 'pending' and befriend_at is null/);
  assert.match(sql, /status = 'accepted' and befriend_at is not null/);
  assert.match(sql, /user_a < user_b/);
  assert.match(sql, /policy "social_profile_select_own"/);
  assert.match(sql, /policy "friendship_select_own"/);
  assert.match(sql, /grant select on table public\.social_profile to authenticated/);
  assert.doesNotMatch(sql, /grant insert on table public\.friendship/);
  assert.match(sql, /function public\.send_friend_request/);
  assert.match(sql, /function public\.accept_friend/);
  assert.match(sql, /function public\.decline_friend/);
  assert.match(sql, /function public\.list_friends/);
  assert.match(sql, /perform public\.ensure_social_profile\(new\.id\)/);
  assert.match(sql, /is_desktop_active/);
  assert.match(sql, /Friend requests are closed/);
  assert.match(sql, /set status = 'accepted'/);
  assert.match(sql, /befriend_at = now\(\)/);
});
