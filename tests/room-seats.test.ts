import assert from "node:assert/strict";
import test from "node:test";
import { SOFA_BOUNDS, WORMHOLE_BOUNDS, pxToLeftPercent, pxToTopPercent } from "../lib/living-room-layout";
import { defaultRoomDecor, setRoomItemPlaced } from "../lib/room-decor";
import { dropOnSeat, reconcileSeats, seatAnchor, seatCapacity, type SeatMap } from "../lib/room-seats";

test("seat capacity follows the piece and whether it is placed", () => {
  const decor = defaultRoomDecor();
  assert.equal(seatCapacity("sofa", decor), 3);
  assert.equal(seatCapacity("armchair", decor), 0);
  assert.equal(seatCapacity("loveseat", decor), 0);
  assert.equal(seatCapacity("shelter", decor), 1);
  assert.equal(seatCapacity("armchair", setRoomItemPlaced(decor, "armchair", true)), 1);
  assert.equal(seatCapacity("loveseat", setRoomItemPlaced(decor, "loveseat", true)), 2);
});

test("dropping on the sofa fills three seats and leaves the rest on the floor", () => {
  const decor = defaultRoomDecor();
  const spot = {
    left: pxToLeftPercent(SOFA_BOUNDS.x + SOFA_BOUNDS.width / 2),
    top: pxToTopPercent(SOFA_BOUNDS.y + SOFA_BOUNDS.height / 2),
  };
  let seats: SeatMap = {};
  const sat = [];
  for (const petId of ["a", "b", "c", "d", "e"]) {
    const result = dropOnSeat(decor, seats, petId, spot);
    if (result) {
      seats = result.seats;
      sat.push(result.spot);
    }
  }
  assert.equal(Object.keys(seats).length, 3);
  assert.equal(seats.d, undefined);
  assert.equal(seats.e, undefined);
  assert.equal(new Set(Object.values(seats).map((seat) => seat.seat)).size, 3);
  const removed = setRoomItemPlaced(decor, "sofa", false);
  assert.deepEqual(reconcileSeats(removed, seats), {});
  assert.equal(seatAnchor(decor, { pieceId: "sofa", seat: 0 })?.left != null, true);
  assert.ok(sat[0]);
});

test("dropping on the adopt bed seats one pet in the nest", () => {
  const decor = defaultRoomDecor();
  const spot = {
    left: pxToLeftPercent(WORMHOLE_BOUNDS.x + WORMHOLE_BOUNDS.width / 2),
    top: pxToTopPercent(WORMHOLE_BOUNDS.y + WORMHOLE_BOUNDS.height / 2),
  };
  const first = dropOnSeat(decor, {}, "a", spot);
  assert.ok(first);
  assert.deepEqual(first.seats.a, { pieceId: "shelter", seat: 0 });
  assert.equal(seatAnchor(decor, { pieceId: "shelter", seat: 0 })?.left != null, true);
  const second = dropOnSeat(decor, first.seats, "b", spot);
  assert.equal(second, null);
});
