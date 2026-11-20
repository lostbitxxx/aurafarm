import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CREW_LIBRARY_PATH,
  CREW_OBSTACLES,
  CREW_PEDESTAL,
  CREW_SEATS,
  CREW_START_SPOTS,
  crewSpawnSpot,
  crewStartSpotsAreOpen,
  dropOnCrewSeat,
  poseFromRow,
} from "../lib/crew-room-layout";
import { spotHitsObstacle } from "../lib/living-room-layout";

test("library seats ring the pedestal and stay on open floor", () => {
  assert.equal(CREW_LIBRARY_PATH, "/pet-assets/room/crew/library.svg");
  assert.equal(CREW_SEATS.length, 6);
  const lefts = CREW_SEATS.map((seat) => seat.anchor.left);
  const tops = CREW_SEATS.map((seat) => seat.anchor.top);
  assert.ok(Math.min(...lefts) < CREW_PEDESTAL.left);
  assert.ok(Math.max(...lefts) > CREW_PEDESTAL.left);
  assert.ok(Math.min(...tops) < CREW_PEDESTAL.top);
  assert.ok(Math.max(...tops) > CREW_PEDESTAL.top);
  assert.equal(spotHitsObstacle(CREW_PEDESTAL, CREW_OBSTACLES), true);
  for (const seat of CREW_SEATS) {
    assert.ok(Math.hypot(seat.anchor.left - CREW_PEDESTAL.left, seat.anchor.top - CREW_PEDESTAL.top) > 10);
  }
  assert.equal(crewStartSpotsAreOpen(), true);
  for (const spot of CREW_START_SPOTS) {
    assert.equal(dropOnCrewSeat(spot, new Set()), null);
  }
});

test("a farmer can take a free library seat and not a taken one", () => {
  const west = CREW_SEATS.find((seat) => seat.id === "w");
  assert.ok(west);
  assert.equal(dropOnCrewSeat(west.anchor, new Set())?.id, "w");
  assert.equal(dropOnCrewSeat(west.anchor, new Set(["w"])), null);
  assert.equal(dropOnCrewSeat(CREW_PEDESTAL, new Set()), null);
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

test("crew poses are read and written with the signed-in server session", () => {
  const sync = readFileSync(new URL("../lib/crew-room-sync.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../lib/actions/farm-crew.ts", import.meta.url), "utf8");
  assert.match(sync, /listFarmCrewPoses/);
  assert.match(sync, /setFarmCrewPose/);
  assert.doesNotMatch(sync, /@\/lib\/supabase\/client/);
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
