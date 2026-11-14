import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  acceptedFriends,
  friendCardsFromRows,
  friendRequestMessage,
  incomingFriendRequests,
  normalizeFriendCode,
  socialStatusLabel,
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
  presence: "offline",
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
  presence: "invisible",
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
        presence: "online",
      },
      { friend_id: "", status: "accepted" },
    ]),
    [{ ...ada, clothes: null, presence: "online" }],
  );
  assert.equal(socialStatusLabel("aurafarming"), "Aurafarming");
  assert.equal(socialStatusLabel("invisible"), "Invisible");
  assert.equal(friendRequestMessage("column allow_status_seen does not exist"), "Run migration 0026 before using social status.");
});

test("the desk opens Friends and Leaderboard from Social", () => {
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  const desk = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  const dialog = readFileSync(new URL("../components/friends-dialog.tsx", import.meta.url), "utf8");
  const action = readFileSync(new URL("../lib/actions/friends.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");

  assert.match(header, /Social/);
  assert.match(header, /onClick=\{onOpenFriends\}/);
  assert.match(header, /<span>Friends<\/span>/);
  assert.match(header, /pendingFriendRequest \? <span className="request-dot"/);
  assert.match(header, /aria-haspopup="menu">\s*Social\s*<\/button>/);
  assert.doesNotMatch(header, /aria-haspopup="menu"[\s\S]{0,40}request-dot/);
  assert.match(header, />\s*Social Settings\s*</);
  assert.match(header, /onClick=\{onOpenSocialSettings\}/);
  assert.match(header, /onClick=\{onOpenLeaderboard\}[\s\S]*Leaderboard/);
  assert.match(desk, /onOpenFriends=\{\(\) => setDialog\("friends"\)\}/);
  assert.match(desk, /pendingFriendRequest=\{incomingFriendRequests\(friendRows\)\.length > 0\}/);
  assert.match(desk, /onOpenSocialSettings=\{\(\) => setDialog\("social-settings"\)\}/);
  assert.match(desk, /onOpenLeaderboard=\{\(\) => setDialog\("leaderboard"\)\}/);
  assert.match(desk, /<LeaderboardDialog/);
  assert.match(desk, /<FriendsDialog[\s\S]*friendCode=\{friendCode\}/);
  assert.match(desk, /<SocialSettingsDialog/);
  assert.match(desk, /<SocialPresence/);
  assert.match(page, /loadFriendDesk/);

  assert.match(dialog, /Friend List/);
  assert.match(dialog, /Add Friends/);
  assert.match(dialog, /pendingRequest \? <span className="request-dot"/);
  assert.match(dialog, /Send Request/);
  assert.match(dialog, /button-accept/);
  assert.match(dialog, /Accept/);
  assert.match(dialog, /button-decline/);
  assert.match(dialog, /Decline/);
  assert.match(dialog, /sendFriendRequest/);
  assert.match(dialog, /acceptFriend/);
  assert.match(dialog, /declineFriend/);
  assert.match(dialog, /friend\.displayName/);
  assert.match(dialog, /socialStatusLabel/);
  assert.match(dialog, /PixelPetArt/);
  assert.match(dialog, /friends-panel/);
  assert.match(dialog, /Your friend code/);
  assert.match(dialog, /navigator\.clipboard\.writeText\(friendCode\)/);

  const settings = readFileSync(new URL("../components/social-settings-dialog.tsx", import.meta.url), "utf8");
  assert.match(settings, /Your friend code/);
  assert.match(settings, /Copy/);
  assert.match(settings, /navigator\.clipboard\.writeText/);
  assert.match(settings, /Who can add you/);
  assert.match(settings, /Who can see your status/);
  assert.match(settings, /updateSocialSettings/);

  const presence = readFileSync(new URL("../components/social-presence.tsx", import.meta.url), "utf8");
  assert.match(presence, /touchSocialPresence/);
  assert.match(presence, /10_000/);
  assert.match(presence, /pagehide/);
  const study = readFileSync(new URL("../lib/actions/study.ts", import.meta.url), "utf8");
  assert.match(study, /complete_study_timer[\s\S]*touchSocialPresence\(true\)/);
  assert.match(study, /end_study_early[\s\S]*touchSocialPresence\(true\)/);
  assert.match(dialog, /10_000/);
  assert.match(dialog, /void load\(\)/);
  assert.match(dialog, /onClick=\{openFriendList\}/);
  assert.doesNotMatch(presence, /return \(\) => \{[\s\S]*beat\(false\)/);
  const friendDesk = readFileSync(new URL("../lib/friend-desk.ts", import.meta.url), "utf8");
  assert.match(friendDesk, /touchSocialPresence\(true\)/);
  const customize = readFileSync(new URL("../app/customize/page.tsx", import.meta.url), "utf8");
  const session = readFileSync(new URL("../app/dashboard/sessions/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(customize, /<SocialPresence/);
  assert.match(session, /<SocialPresence/);
  assert.match(
    readFileSync(new URL("../lib/customization.ts", import.meta.url), "utf8"),
    /touchSocialPresence\(true\)/,
  );
  const desktop = readFileSync(new URL("../desktop/main.js", import.meta.url), "utf8");
  assert.match(desktop, /touch_social_presence/);
  assert.match(desktop, /source: "pet"/);

  assert.match(action, /send_friend_request/);
  assert.match(action, /accept_friend/);
  assert.match(action, /decline_friend/);
  assert.match(action, /revalidatePath\("\/dashboard"\)/);
  assert.match(action, /update_social_settings/);
  assert.match(action, /touch_social_presence/);
});

test("social status is stored for every farmer and hidden when friends may not see it", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0026_social_status.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /allow_status_seen text not null default 'friend_only'/);
  assert.match(sql, /allow_status_seen in \('friend_and_group', 'friend_only', 'group_only', 'none'\)/);
  assert.match(sql, /current_status text not null default 'offline'/);
  assert.match(sql, /current_status in \('online', 'aurafarming', 'offline'\)/);
  assert.match(sql, /when studying then 'aurafarming'/);
  assert.match(sql, /when desk_at is not null or pet_at is not null then 'online'/);
  assert.match(sql, /function public\.touch_social_presence/);
  assert.match(sql, /function public\.update_social_settings/);
  assert.match(sql, /allow_status_seen in \('friend_only', 'friend_and_group'\)/);
  assert.match(sql, /else 'invisible'/);
  assert.doesNotMatch(sql, /allow_status_seen = 'none' then/);
  assert.match(sql, /drop function if exists public\.list_friends\(\)/);
  assert.match(sql, /after insert or update of status on public\.study_sessions/);
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
