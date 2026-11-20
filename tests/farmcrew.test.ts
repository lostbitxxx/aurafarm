import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  crewOccupantsFromRows,
  crewShowsAurafarming,
  farmCrewCardsFromRows,
  farmCrewDetailFromRows,
  farmCrewJoinRequestsFromRows,
  farmCrewMembersFromRows,
  farmCrewMessage,
  publicFarmCrewsFromRows,
} from "../lib/farm-crew";
import { requiresAccount } from "../lib/routes";

const crewId = "11111111-1111-4111-8111-111111111111";

test("farm crew rows keep membership, public crews, and the room", () => {
  const [crew] = farmCrewCardsFromRows([
    {
      crew_id: crewId,
      name: "  Pond  ",
      description: "Study by the water",
      crew_code: "PND23456",
      pet_type: "lantern_moth",
      pet_color: "sage",
      member_count: 3,
      role: "owner",
    },
    { crew_id: "nope", name: "Skip" },
  ]);
  assert.equal(crew?.name, "Pond");
  assert.equal(crew?.code, "PND23456");
  assert.equal(crew?.petType, "lantern_moth");
  assert.equal(crew?.memberCount, 3);
  assert.equal(crew?.role, "owner");
  assert.equal(
    farmCrewCardsFromRows([
      {
        crew_id: crewId,
        name: "Pond",
        crew_code: "PND23456",
        member_count: 2,
        role: "admin",
      },
    ])[0]?.role,
    "admin",
  );

  const detail = farmCrewDetailFromRows([
    {
      crew_id: crewId,
      name: "Pond",
      description: "Study by the water",
      pet_type: "baby_slime",
      member_count: 3,
      is_public: false,
      role: "admin",
    },
  ]);
  assert.equal(detail?.isPublic, false);
  assert.equal(detail?.role, "admin");
  const members = farmCrewMembersFromRows([
    { user_id: crewId, display_name: "Ada", role: "owner" },
    {
      user_id: "22222222-2222-4222-8222-222222222222",
      display_name: "Bea",
      role: "member",
      pet_type: "baby_slime",
      pet_color: "honey",
      clothes: "little-gentleman-suit",
    },
  ]);
  assert.deepEqual(
    members.map((member) => member.role),
    ["owner", "member"],
  );
  assert.equal(members[1]?.petType, "baby_slime");
  assert.equal(members[1]?.clothes, "little-gentleman-suit");
  assert.equal(members[0]?.petType, null);
  assert.equal(
    farmCrewJoinRequestsFromRows([
      {
        user_id: "33333333-3333-4333-8333-333333333333",
        display_name: "Cam",
        pet_type: "lantern_moth",
        pet_color: "sage",
        clothes: "clothes_a",
      },
    ])[0]?.petType,
    "lantern_moth",
  );

  const [open] = publicFarmCrewsFromRows([
    {
      crew_id: crewId,
      name: "Pond",
      description: "Bring a notebook",
      pet_type: "baby_slime",
      pet_color: "nope",
      member_count: 1,
      requested: true,
    },
  ]);
  assert.equal(open?.description, "Bring a notebook");
  assert.equal(open?.color, null);
  assert.equal(open?.requested, true);

  const [farmer] = crewOccupantsFromRows([
    {
      farmer_id: crewId,
      display_name: "Ada",
      pet_type: "baby_slime",
      pet_color: "honey",
      clothes: "little-gentleman-suit",
      presence: "aurafarming",
    },
    { farmer_id: crewId, display_name: "Hidden", presence: "offline" },
  ]);
  assert.equal(farmer?.clothes, "little-gentleman-suit");
  assert.equal(farmer?.presence, "aurafarming");
  assert.equal(
    crewShowsAurafarming(
      { farmerId: crewId, presence: "online" },
      crewId,
      true,
    ),
    true,
  );
  assert.equal(
    crewShowsAurafarming(
      { farmerId: crewId, presence: "aurafarming" },
      crewId,
      false,
    ),
    false,
  );
  assert.equal(
    crewShowsAurafarming(
      { farmerId: "22222222-2222-4222-8222-222222222222", presence: "aurafarming" },
      crewId,
      false,
    ),
    true,
  );
  assert.equal(crewOccupantsFromRows([{ farmer_id: crewId, presence: "offline" }]).length, 0);
});

test("farm crew errors point at migration 0039", () => {
  assert.equal(
    farmCrewMessage("Could not find the function public.list_my_farm_crews"),
    "Run migrations 0039 and 0040 before using FarmCrew.",
  );
  assert.equal(
    farmCrewMessage("Could not find the function public.set_farm_crew_pose"),
    "Run migration 0048 before pet positions can match across the FarmCrew.",
  );
  assert.equal(
    farmCrewMessage("permission denied for table farm_crew_pose"),
    "Run migration 0048 before pet positions can match across the FarmCrew.",
  );
  assert.equal(
    farmCrewMessage('column reference "user_id" is ambiguous'),
    "Run migration 0048 before pet positions can match across the FarmCrew.",
  );
  assert.equal(
    farmCrewMessage("permission denied for function get_farm_crew"),
    "FarmCrew could not be updated.",
  );
  assert.equal(farmCrewMessage("You are already in this FarmCrew."), "You are already in this FarmCrew.");
  assert.equal(
    farmCrewMessage("Could not find the function public.list_farm_crew_members"),
    "Run migration 0042 before managing a FarmCrew.",
  );
  assert.equal(farmCrewMessage("Admins can only remove members."), "Admins can only remove members.");
  assert.equal(
    farmCrewMessage("Could not find the function public.list_farm_crew_join_requests"),
    "Run migration 0043 before reviewing FarmCrew members.",
  );
});

test("Social board embeds FarmCrew and Visit goes to the crew room", () => {
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  const desk = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  const board = readFileSync(new URL("../components/social-board-dialog.tsx", import.meta.url), "utf8");
  const dialog = readFileSync(new URL("../components/farm-crew-dialog.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/farmcrew/[id]/page.tsx", import.meta.url), "utf8");
  const room = readFileSync(new URL("../components/crew-room.tsx", import.meta.url), "utf8");
  const sql = readFileSync(new URL("../supabase/migrations/0039_farm_crew.sql", import.meta.url), "utf8");
  const visibility = readFileSync(new URL("../supabase/migrations/0040_farm_crew_visibility.sql", import.meta.url), "utf8");

  assert.doesNotMatch(header, /onOpenFarmCrew/);
  assert.match(desk, /onOpenSocial=\{\(\) => showSection\("social"\)\}/);
  assert.match(desk, /<SocialBoardDialog/);
  assert.match(board, /<FarmCrewDialog[\s\S]*embedded/);
  assert.match(dialog, /FarmCrew List/);
  assert.match(dialog, /Join FarmCrew/);
  assert.match(dialog, /Create FarmCrew/);
  assert.doesNotMatch(dialog, /Wants to join/);
  assert.match(dialog, /aria-label="FarmCrew code"/);
  assert.match(dialog, /Send Request/);
  assert.match(dialog, /href=\{`\/farmcrew\/\$\{crew\.crewId\}`\}[\s\S]*Visit/);
  assert.match(dialog, /requestFarmCrewByCode/);
  assert.match(dialog, /requestPublicFarmCrew/);
  assert.match(dialog, /createFarmCrew/);
  assert.match(dialog, /name="crew-visibility"/);
  assert.match(dialog, />\s*Public\s*</);
  assert.match(dialog, />\s*Private\s*</);
  assert.match(page, /loadFarmCrewRoom/);
  const screen = readFileSync(new URL("../components/farm-crew-screen.tsx", import.meta.url), "utf8");
  assert.match(screen, /AuraFarmCrew/);
  assert.match(screen, /Back to Dashboard/);
  assert.match(screen, /Leaderboard/);
  assert.doesNotMatch(screen, /className="topbar-link"[\s\S]{0,80}Leaderboard/);
  assert.doesNotMatch(screen, /className="topbar-drawer-link"[\s\S]{0,80}Leaderboard/);
  assert.match(screen, /onOpenLeaderboard=\{\(\) => setPanel\("board"\)\}/);
  assert.match(screen, /loadFarmCrewLeaderboard/);
  assert.match(screen, /<FarmDialog title="Leaderboard"/);
  assert.match(screen, /managesFarmCrew\(detail\.role\)/);
  assert.match(screen, />\s*Admin\s*</);
  assert.match(screen, /<CrewAdminDialog/);
  assert.match(screen, /topbar-brand/);
  assert.match(screen, /CrewSessionTimer[\s\S]*<CrewRoom/);
  assert.match(screen, /StudyClock/);
  assert.match(screen, /crew-top is-studying/);
  assert.match(screen, /Studying with you/);
  assert.match(screen, /Website timer is tracking this session/);
  assert.match(screen, /End session early/);
  assert.match(screen, /endStudyEarly/);
  assert.match(screen, /Keep studying/);
  assert.match(screen, /<CrewStudyStart/);
  const start = readFileSync(new URL("../components/crew-study-start.tsx", import.meta.url), "utf8");
  assert.match(start, /Start studying/);
  assert.match(start, /startStudySession/);
  assert.match(start, /How long will you study\?/);
  assert.match(start, /FARM AURA/);
  assert.match(start, /desktopLink \? "tracker-cards is-desktop-ready" : "tracker-cards"/);
  assert.match(start, /tracker-option-desktop/);
  assert.match(start, /tracker-option-website/);
  assert.match(start, /href=\{desktopLink\}[\s\S]*setStartOpen\(false\)[\s\S]*Open Aurafarm/);
  const crewDesk = readFileSync(new URL("../lib/farm-crew-desk.ts", import.meta.url), "utf8");
  assert.match(crewDesk, /preferred_session_minutes/);
  assert.match(crewDesk, /study_sessions/);
  assert.match(crewDesk, /\.eq\("status", "active"\)/);
  const admin = readFileSync(new URL("../components/crew-admin-dialog.tsx", import.meta.url), "utf8");
  assert.match(admin, /<FarmDialog title="Admin"/);
  assert.match(admin, />\s*General\s*</);
  assert.match(admin, />\s*Members\s*</);
  assert.match(admin, /updateFarmCrewSettings/);
  assert.match(admin, /name="admin-crew-visibility"/);
  assert.match(admin, />\s*Promote\s*</);
  assert.match(admin, />\s*Remove\s*</);
  assert.match(admin, /PixelPetArt/);
  assert.match(admin, /Join requests/);
  assert.match(admin, /button-accept/);
  assert.match(admin, /acceptFarmCrewRequest/);
  assert.match(admin, /declineFarmCrewRequest/);
  assert.match(admin, /viewerRole === "owner"/);
  assert.match(admin, /viewerRole === "admin" && member\.role === "member"/);
  assert.doesNotMatch(screen, /LEADERBOARD_SCOPES|LeaderboardScopeSwitch/);
  assert.doesNotMatch(page, /export const dynamic/);
  assert.match(room, /Aurafarming/);
  assert.match(room, /living-room/);
  assert.match(room, /CREW_LIBRARY_PATH/);
  assert.match(room, /is-remote/);
  assert.match(room, /occupant\.farmerId === viewerId/);
  assert.match(room, /CREW_PEDESTAL/);
  assert.match(screen, /viewerId=\{room\.userId\}/);
  assert.match(screen, /viewerStudying=\{Boolean\(session\)\}/);
  assert.match(room, /crewShowsAurafarming/);
  assert.match(screen, /mascot=\{\{ petType: detail\.petType, color: detail\.color \}\}/);
  assert.equal(requiresAccount("/farmcrew/11111111-1111-4111-8111-111111111111"), true);
  assert.equal(requiresAccount("/farmcrew"), false);

  assert.match(sql, /create table if not exists public\.farm_crew/);
  assert.match(sql, /create table if not exists public\.farm_crew_member/);
  assert.match(sql, /security definer/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /function public\.create_farm_crew\(input_name text, input_description text, input_public boolean\)/);
  assert.match(visibility, /drop function if exists public\.create_farm_crew\(text, text\)/);
  assert.match(visibility, /input_public/);
  assert.match(sql, /function public\.list_my_farm_crews/);
  assert.match(sql, /function public\.list_public_farm_crews/);
  assert.match(sql, /function public\.request_farm_crew_by_code/);
  assert.match(sql, /function public\.list_farm_crew_room/);
  assert.match(sql, /allow_status_seen in \('friend_and_group', 'group_only'\)/);
  const presenceSql = readFileSync(new URL("../supabase/migrations/0045_crew_room_presence.sql", import.meta.url), "utf8");
  assert.match(presenceSql, /interval '3 minutes'/);
  assert.match(presenceSql, /interval '15 seconds'/);
  assert.match(presenceSql, /allow_status_seen <> 'none'/);
  assert.match(presenceSql, /current_status in \('online', 'aurafarming'\)/);
  assert.match(sql, /revoke all on function public\.join_farm_crew\(uuid, boolean\)/);
  assert.doesNotMatch(sql, /grant execute on function public\.join_farm_crew/);

  const adminSql = readFileSync(new URL("../supabase/migrations/0042_farm_crew_admin.sql", import.meta.url), "utf8");
  assert.match(adminSql, /role in \('owner', 'admin', 'member'\)/);
  assert.match(adminSql, /function public\.update_farm_crew_settings/);
  assert.match(adminSql, /actor not in \('owner', 'admin'\)/);
  assert.match(adminSql, /function public\.list_farm_crew_members/);
  assert.match(adminSql, /function public\.promote_farm_crew_member/);
  assert.match(adminSql, /set role = 'admin'/);
  assert.match(adminSql, /and role = 'member'/);
  assert.match(adminSql, /function public\.kick_farm_crew_member/);
  assert.match(adminSql, /Admins can only remove members/);
  assert.match(adminSql, /The owner stays in the crew/);
  assert.match(adminSql, /actor = 'owner' or role = 'member'/);
  assert.match(adminSql, /security definer/);
  assert.match(adminSql, /grant execute on function public\.update_farm_crew_settings\(uuid, text, text, boolean\) to authenticated/);
  assert.match(adminSql, /grant execute on function public\.kick_farm_crew_member\(uuid, uuid\) to authenticated/);
  assert.doesNotMatch(adminSql, /grant execute on function public\.update_farm_crew_settings\(uuid, text, text, boolean\) to anon/);

  const rosterSql = readFileSync(new URL("../supabase/migrations/0043_farm_crew_roster.sql", import.meta.url), "utf8");
  assert.match(rosterSql, /drop function if exists public\.list_farm_crew_members\(uuid\)/);
  assert.match(rosterSql, /user_pets\.is_desktop_active/);
  assert.match(rosterSql, /user_pets\.clothes/);
  assert.match(rosterSql, /function public\.list_farm_crew_join_requests/);
  assert.match(rosterSql, /applicant\.status = 'pending'/);
  assert.match(rosterSql, /manager\.role in \('owner', 'admin'\)/);
  assert.match(rosterSql, /role in \('owner', 'admin'\)/);
  assert.match(rosterSql, /security definer/);
  assert.match(rosterSql, /grant execute on function public\.list_farm_crew_join_requests\(uuid\) to authenticated/);
  assert.match(rosterSql, /grant execute on function public\.accept_farm_crew_request\(uuid, uuid\) to authenticated/);
});
