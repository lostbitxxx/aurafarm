import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CREW_BLACKBOARD,
  CREW_LIBRARY_PATH,
  CREW_OBSTACLES,
  CREW_PEDESTAL,
  CREW_SEATS,
  CREW_SEATS_PATH,
  CREW_START_SPOTS,
  crewSpawnSpot,
  crewStartSpotsAreOpen,
  dropOnCrewSeat,
  ejectFromCrewSeats,
  followCrewPose,
  newerCrewPose,
  poseFromRow,
  resolveCrewDrop,
  spotInAnyCrewSeat,
} from "../lib/crew-room-layout";
import { spotHitsObstacle } from "../lib/living-room-layout";
import { petStackLayers } from "../lib/pet-assets";

test("lobby seats ring the pedestal and stay on open floor", () => {
  assert.equal(CREW_LIBRARY_PATH, "/pet-assets/room/crew/library.svg");
  assert.equal(CREW_SEATS_PATH, "/pet-assets/room/crew/seats.svg");
  const library = readFileSync(new URL("../public/pet-assets/room/crew/library.svg", import.meta.url), "utf8");
  const seats = readFileSync(new URL("../public/pet-assets/room/crew/seats.svg", import.meta.url), "utf8");
  assert.equal(library.match(/href="#shelf"/g)?.length, 1);
  assert.doesNotMatch(library, /href="#chair"/);
  assert.match(seats, /fill="#6e4b32"/);
  assert.match(library, /x="492" y="18" width="92" height="86" fill="#8a6a48"/);
  assert.match(library, /fill="#3a5a40"/);
  assert.equal(CREW_BLACKBOARD.x, 492);
  assert.ok(CREW_BLACKBOARD.x > 400);
  const room = readFileSync(new URL("../components/crew-room.tsx", import.meta.url), "utf8");
  assert.match(room, /aria-label="Leaderboard"/);
  assert.match(room, /onOpenLeaderboard/);
  assert.match(room, /CREW_SEATS_PATH/);
  assert.match(room, /crew-lobby-seat/);
  assert.match(room, /lobbyDesk/);
  assert.match(room, /useStudyPose/);
  assert.match(room, /resolveCrewDrop/);
  assert.match(room, /!present\.has\(pose\.userId\)/);
  assert.equal(CREW_SEATS.length, 6);
  const lefts = CREW_SEATS.map((seat) => seat.anchor.left);
  const tops = CREW_SEATS.map((seat) => seat.anchor.top);
  assert.ok(Math.min(...lefts) < CREW_PEDESTAL.left);
  assert.ok(Math.max(...lefts) > CREW_PEDESTAL.left);
  assert.ok(Math.min(...tops) < CREW_PEDESTAL.top);
  assert.ok(Math.max(...tops) > CREW_PEDESTAL.top);
  assert.equal(spotHitsObstacle(CREW_PEDESTAL, CREW_OBSTACLES), true);
  const seatWidth = CREW_SEATS[0].maxLeft - CREW_SEATS[0].minLeft;
  const seatHeight = CREW_SEATS[0].maxTop - CREW_SEATS[0].minTop;
  for (const seat of CREW_SEATS) {
    assert.ok(Math.hypot(seat.anchor.left - CREW_PEDESTAL.left, seat.anchor.top - CREW_PEDESTAL.top) > 10);
    assert.ok(Math.abs(seat.maxLeft - seat.minLeft - seatWidth) < 0.001);
    assert.ok(Math.abs(seat.maxTop - seat.minTop - seatHeight) < 0.001);
  }
  const frontRight = CREW_SEATS.find((seat) => seat.id === "se");
  assert.ok(frontRight);
  assert.equal(dropOnCrewSeat(frontRight.anchor, new Set())?.id, "se");
  assert.equal(
    dropOnCrewSeat({ left: frontRight.anchor.left, top: frontRight.maxTop - 0.5 }, new Set())?.id,
    "se",
  );
  // Just right of the tight sprite box, still on the 5 o'clock footprint.
  assert.equal(dropOnCrewSeat({ left: 71.2, top: 72 }, new Set())?.id, "se");
  assert.equal(resolveCrewDrop({ left: 71.2, top: 72 }, new Set()).seat?.id, "se");
  // The tabletop sits just below the back-right chair. That drop stays on 5 o'clock.
  assert.equal(dropOnCrewSeat({ left: frontRight.anchor.left, top: 56 }, new Set())?.id, "se");
  assert.equal(dropOnCrewSeat({ left: frontRight.anchor.left, top: 60 }, new Set())?.id, "se");
  assert.equal(dropOnCrewSeat({ left: frontRight.anchor.left, top: 64 }, new Set(["se"])), null);
  assert.equal(crewStartSpotsAreOpen(), true);
  for (const spot of CREW_START_SPOTS) {
    assert.equal(dropOnCrewSeat(spot, new Set()), null);
  }
});

test("a farmer can take a free lobby seat and not a taken one", () => {
  const west = CREW_SEATS.find((seat) => seat.id === "w");
  assert.ok(west);
  assert.equal(dropOnCrewSeat(west.anchor, new Set())?.id, "w");
  assert.equal(dropOnCrewSeat(west.anchor, new Set(["w"])), null);
  assert.equal(dropOnCrewSeat(CREW_PEDESTAL, new Set()), null);
});

test("a remote pet walks toward the latest pose without passing it", () => {
  const room = { width: 600, height: 300 };
  const current = { left: 20, top: 70 };
  const target = { left: 30, top: 70 };
  const step = followCrewPose(current, target, "walking", 0.05, room);
  assert.ok(step.left > current.left);
  assert.ok(step.left < target.left);
  assert.equal(followCrewPose(current, target, "sitting", 0.05, room).left, target.left);
  assert.equal(followCrewPose(current, { left: 80, top: 70 }, "walking", 1, room).left, 80);
});

test("occupied seat drops eject to floor outside every sit zone", () => {
  const west = CREW_SEATS.find((seat) => seat.id === "w");
  assert.ok(west);
  const dropped = resolveCrewDrop(west.anchor, new Set(["w"]));
  assert.equal(dropped.seat, null);
  assert.equal(spotInAnyCrewSeat(dropped.spot), false);
  assert.equal(spotHitsObstacle(dropped.spot, CREW_OBSTACLES), false);
  const ejected = ejectFromCrewSeats(west.anchor);
  assert.equal(spotInAnyCrewSeat(ejected), false);
});

test("sitting study stack uses lobby desk and shared pens", () => {
  const lobby = petStackLayers("baby_slime", "study1", { lobbyDesk: true });
  assert.equal(lobby.chair, "/pet-assets/props/study/chair.svg");
  assert.equal(lobby.desk, "/pet-assets/props/study/desk-long.svg");
  assert.equal(lobby.pen, "/pet-assets/props/study/pen-1.svg");
  assert.equal(lobby.floor, null);
  const offSeat = petStackLayers("baby_slime", "study1");
  assert.equal(offSeat.desk, "/pet-assets/props/study/desk.svg");
  assert.equal(offSeat.floor, "/pet-assets/props/study/floor.svg");
  const desk = readFileSync(new URL("../public/pet-assets/props/study/desk-long.svg", import.meta.url), "utf8");
  assert.match(desk, /viewBox="0 0 64 116"/);
  assert.match(desk, /v70/);
  const pen = readFileSync(new URL("../public/pet-assets/props/study/pen-1.svg", import.meta.url), "utf8");
  assert.match(pen, /scale\(1 -1\)/);
});

test("the same farmer spawns in the same spot", () => {
  const first = crewSpawnSpot("farmer-1");
  assert.deepEqual(crewSpawnSpot("farmer-1"), first);
  assert.ok(CREW_START_SPOTS.some((spot) => spot.left === first.left && spot.top === first.top));
});

test("pose rows keep a known chair and drop an unknown one", () => {
  const sitting = poseFromRow({
    user_id: "farmer-1",
    left_pct: "12.5",
    top_pct: 40,
    mode: "sitting",
    seat_id: "ne",
    face_left: true,
  });
  assert.equal(sitting?.mode, "sitting");
  assert.equal(sitting?.seatId, "ne");
  assert.equal(sitting?.left, 12.5);
  assert.equal(sitting?.faceLeft, true);
  const loose = poseFromRow({
    user_id: "farmer-1",
    left_pct: 10,
    top_pct: 10,
    mode: "sitting",
    seat_id: "throne",
    face_left: false,
  });
  assert.equal(loose?.seatId, null);
  assert.equal(
    poseFromRow({ user_id: "farmer-1", left_pct: 1, top_pct: 1, mode: "flying" }),
    null,
  );
});

test("a later pose replaces an earlier one and an unstamped echo does not rewind it", () => {
  const older = poseFromRow({
    user_id: "farmer-1",
    left_pct: 10,
    top_pct: 20,
    mode: "walking",
    face_left: false,
    updated_at: "2026-11-23T09:00:00.000Z",
  });
  const newer = poseFromRow({
    user_id: "farmer-1",
    left_pct: 40,
    top_pct: 50,
    mode: "walking",
    face_left: true,
    updated_at: "2026-11-23T09:00:01.000Z",
  });
  assert.ok(older && newer);
  assert.equal(newerCrewPose(older, newer).left, 40);
  assert.equal(newerCrewPose(newer, older).left, 40);
  const echo = { ...newer, left: 1, updatedAt: undefined };
  assert.equal(newerCrewPose(newer, echo).left, 40);
  assert.equal(newerCrewPose(undefined, echo).left, 1);
});

test("crew poses publish through the server and arrive on the realtime stream", () => {
  const sync = readFileSync(new URL("../lib/crew-room-sync.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../lib/actions/farm-crew.ts", import.meta.url), "utf8");
  assert.match(sync, /listFarmCrewPoses/);
  assert.match(sync, /setFarmCrewPose/);
  assert.match(sync, /postgres_changes/);
  assert.match(sync, /farm_crew_pose/);
  assert.match(sync, /newerCrewPose/);
  assert.match(sync, /@\/lib\/supabase\/client/);
  assert.match(actions, /function listFarmCrewPoses/);
  assert.match(actions, /function setFarmCrewPose/);
  assert.match(actions, /list_farm_crew_poses/);
  assert.match(actions, /set_farm_crew_pose/);
});

test("crew pose migration lets a member publish and keeps a taken chair", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0048_crew_room_pose.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.farm_crew_pose/);
  assert.match(sql, /function public\.set_farm_crew_pose/);
  assert.match(sql, /security definer/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /status = 'accepted'/);
  assert.match(sql, /seat_id in \('nw', 'ne', 'w', 'e', 'sw', 'se'\)/);
  assert.match(sql, /pose\.user_id <> auth\.uid\(\)/);
  assert.match(sql, /function public\.list_farm_crew_poses/);
  assert.match(sql, /member\.user_id = auth\.uid\(\)/);
  assert.match(sql, /supabase_realtime/);
  assert.doesNotMatch(sql, /grant insert|grant update|grant delete/);
});

test("crew pose realtime migration lets members hear rows without reading the member table", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0050_crew_pose_realtime.sql", import.meta.url), "utf8");
  assert.match(sql, /function public\.can_read_farm_crew_pose/);
  assert.match(sql, /security definer/);
  assert.match(sql, /member\.status = 'accepted'/);
  assert.match(sql, /grant select on public\.farm_crew_pose to authenticated/);
  assert.match(sql, /farm_crew_pose_select/);
  assert.match(sql, /supabase_realtime/);
  assert.match(sql, /replica identity full/);
  assert.doesNotMatch(sql, /grant select on public\.farm_crew_member/);
  assert.doesNotMatch(sql, /grant insert|grant update|grant delete/);
});
