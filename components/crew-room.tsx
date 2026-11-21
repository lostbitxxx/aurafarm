"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { crewShowsAurafarming, type CrewOccupant } from "@/lib/farm-crew";
import {
  CREW_BLACKBOARD,
  CREW_LIBRARY_PATH,
  CREW_OBSTACLES,
  CREW_PEDESTAL,
  CREW_SEATS,
  CREW_START_SPOTS,
  CREW_CHAIR_BACK_PATH,
  CREW_TABLE_PATH,
  CREW_WALK_BOUNDS,
  crewDisplaySpot,
  crewSpawnSpot,
  dropOnCrewSeat,
  type CrewPose,
  type CrewPoseMode,
} from "@/lib/crew-room-layout";
import { useCrewPoses } from "@/lib/crew-room-sync";
import { roomDepthZ, ROOM_DRAG_Z } from "@/lib/living-room-layout";
import {
  dragPastThreshold,
  facingFromDirection,
  pickWalkDirection,
  pointerPercentInRoom,
  randomIdleMs,
  randomWalkMs,
  resolveWanderSpot,
  WANDER_SPEED_PX,
  WANDER_VERTICAL_RATIO,
  spotFromForeheadPointer,
  stepWanderSpot,
  type WanderDir,
  type WanderSpot,
} from "@/lib/living-room-wander";
import { PixelPetArt, useWalkPose } from "./pixel-pet";

function clampDrag(spot: WanderSpot): WanderSpot {
  return {
    left: Math.min(96, Math.max(4, spot.left)),
    top: Math.min(92, Math.max(8, spot.top)),
  };
}

function CrewFarmer({
  occupant,
  viewerId,
  pose,
  loaded,
  taken,
  roomRef,
  publish,
  viewerStudying,
}: {
  occupant: CrewOccupant;
  viewerId: string;
  pose: CrewPose | undefined;
  loaded: boolean;
  taken: ReadonlySet<string>;
  roomRef: RefObject<HTMLDivElement | null>;
  publish: (pose: CrewPose) => Promise<CrewPose | null>;
  viewerStudying: boolean;
}) {
  const mine = occupant.farmerId === viewerId;
  const studying = crewShowsAurafarming(occupant, viewerId, viewerStudying);
  const spawn = crewSpawnSpot(occupant.farmerId);
  const [position, setPosition] = useState(spawn);
  const [shown, setShown] = useState(spawn);
  const [walking, setWalking] = useState(false);
  const [faceLeft, setFaceLeft] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [seatId, setSeatId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const positionRef = useRef(spawn);
  const shownRef = useRef(spawn);
  const dirRef = useRef<WanderDir>({ x: 1, y: 0 });
  const faceLeftRef = useRef(false);
  const walkingRef = useRef(false);
  const draggingRef = useRef(false);
  const phaseUntilRef = useRef(0);
  const takenRef = useRef(taken);
  const poseRef = useRef(pose);
  const pendingRef = useRef<CrewPose | null>(null);
  const lastSentRef = useRef(0);
  const timerRef = useRef(0);
  const sendIdRef = useRef(0);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  takenRef.current = taken;
  poseRef.current = pose;
  const ownWalking = mine && ready && walking && !studying && !dragging && !seatId;
  const remoteWalking = !mine && pose?.mode === "walking";
  const walkPose = useWalkPose(ownWalking || remoteWalking);

  useEffect(() => {
    if (!mine || !loaded || ready) return;
    if (pose?.mode === "sitting" && pose.seatId) {
      const spot = crewDisplaySpot(pose);
      positionRef.current = spot;
      setPosition(spot);
      setSeatId(pose.seatId);
    } else if (pose) {
      const spot = { left: pose.left, top: pose.top };
      positionRef.current = spot;
      setPosition(spot);
    }
    if (pose) {
      faceLeftRef.current = pose.faceLeft;
      setFaceLeft(pose.faceLeft);
    }
    setReady(true);
  }, [loaded, mine, pose, ready]);

  useEffect(() => {
    if (!mine || !ready || studying || seatId || dragging) {
      walkingRef.current = false;
      setWalking(false);
      return;
    }
    let frame = 0;
    let last = performance.now();
    phaseUntilRef.current = last + randomIdleMs();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    const enterIdle = (now: number) => {
      if (walkingRef.current) {
        walkingRef.current = false;
        setWalking(false);
      }
      phaseUntilRef.current = now + randomIdleMs();
    };

    const enterWalk = (now: number) => {
      if (media.matches) {
        enterIdle(now);
        return;
      }
      dirRef.current = pickWalkDirection();
      const nextFace = facingFromDirection(dirRef.current, faceLeftRef.current);
      if (nextFace !== faceLeftRef.current) {
        faceLeftRef.current = nextFace;
        setFaceLeft(nextFace);
      }
      walkingRef.current = true;
      setWalking(true);
      phaseUntilRef.current = now + randomWalkMs();
    };

    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      const rawDt = (now - last) / 1000;
      last = now;
      if (!walkingRef.current) {
        if (now >= phaseUntilRef.current) enterWalk(now);
        return;
      }
      if (now >= phaseUntilRef.current) {
        enterIdle(now);
        return;
      }
      const room = roomRef.current;
      const stepped = stepWanderSpot(
        positionRef.current,
        dirRef.current,
        rawDt,
        { width: room?.clientWidth ?? 640, height: room?.clientHeight ?? 320 },
        CREW_WALK_BOUNDS,
        WANDER_SPEED_PX,
        WANDER_VERTICAL_RATIO,
        CREW_OBSTACLES,
      );
      if (!stepped.moved) {
        enterIdle(now);
        return;
      }
      positionRef.current = stepped.spot;
      setPosition(stepped.spot);
      if (stepped.hitBound) enterIdle(now);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [dragging, mine, ready, roomRef, seatId, studying]);

  useEffect(() => {
    if (mine) return;
    let frame = 0;
    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      const currentPose = poseRef.current;
      const target = currentPose ? crewDisplaySpot(currentPose) : crewSpawnSpot(occupant.farmerId);
      const mode = currentPose?.mode;
      const current = shownRef.current;
      const glide = mode === "walking" || mode === "dragging";
      const next = glide
        ? {
            left: current.left + (target.left - current.left) * 0.35,
            top: current.top + (target.top - current.top) * 0.35,
          }
        : target;
      if (Math.abs(next.left - current.left) < 0.05 && Math.abs(next.top - current.top) < 0.05) {
        if (current.left === target.left && current.top === target.top) return;
        shownRef.current = target;
        setShown(target);
        return;
      }
      shownRef.current = next;
      setShown(next);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [mine, occupant.farmerId]);

  useEffect(() => {
    if (!mine || !ready) return;
    const mode: CrewPoseMode = dragging ? "dragging" : seatId ? "sitting" : walking ? "walking" : "idle";
    const next: CrewPose = {
      userId: viewerId,
      left: position.left,
      top: position.top,
      mode,
      seatId: mode === "sitting" ? seatId : null,
      faceLeft,
    };
    pendingRef.current = next;
    const send = () => {
      const pending = pendingRef.current;
      if (!pending) return;
      const id = ++sendIdRef.current;
      lastSentRef.current = Date.now();
      void publish(pending).then((stored) => {
        if (sendIdRef.current !== id || !stored) return;
        if (pending.mode === "sitting" && stored.mode !== "sitting") {
          const freed = resolveWanderSpot(
            { left: pending.left, top: pending.top },
            CREW_WALK_BOUNDS,
            CREW_OBSTACLES,
            CREW_START_SPOTS,
          );
          positionRef.current = freed;
          setSeatId(null);
          setPosition(freed);
        }
      });
    };
    const elapsed = Date.now() - lastSentRef.current;
    if (mode !== "walking" || elapsed >= 250) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = 0;
      }
      send();
      return;
    }
    if (timerRef.current) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = 0;
      send();
    }, 250 - elapsed);
  }, [dragging, faceLeft, mine, position, publish, ready, seatId, viewerId, walking]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const spot = mine ? position : shown;
  const sitting = mine ? Boolean(seatId) && !dragging : pose?.mode === "sitting";
  const atTable = sitting;
  const draggingNow = mine ? dragging : pose?.mode === "dragging";
  const moving = ownWalking || remoteWalking || draggingNow;
  const shownFace = mine ? faceLeft : Boolean(pose?.faceLeft);
  const studyPose = studying && !moving;
  // On a lobby table: study limbs without the small study desk props (table is the desk).
  const studyFurniture = studyPose && !atTable;

  const place = (clientX: number, clientY: number, wrapHeight: number) => {
    const room = roomRef.current?.getBoundingClientRect();
    if (!room) return;
    const pointer = pointerPercentInRoom(clientX, clientY, room);
    const next = clampDrag(spotFromForeheadPointer(pointer.left, pointer.top, room, wrapHeight));
    positionRef.current = next;
    setPosition(next);
  };

  const finishDrag = (wrapHeight: number) => {
    const drag = dragRef.current;
    dragRef.current = null;
    draggingRef.current = false;
    setDragging(false);
    if (!drag?.dragging) return;
    const seat = dropOnCrewSeat(positionRef.current, takenRef.current);
    if (seat) {
      positionRef.current = seat.anchor;
      setPosition(seat.anchor);
      setSeatId(seat.id);
      return;
    }
    const freed = resolveWanderSpot(
      positionRef.current,
      CREW_WALK_BOUNDS,
      CREW_OBSTACLES,
      CREW_START_SPOTS,
    );
    positionRef.current = freed;
    setPosition(freed);
    setSeatId(null);
    void wrapHeight;
  };

  const body = (
    <>
      <span className="room-pet-label">{occupant.displayName}</span>
      <span className={shownFace ? "room-pet-sprite is-flipped" : "room-pet-sprite"}>
        <PixelPetArt
          petType={occupant.petType}
          color={occupant.color}
          hat={occupant.hat}
          clothes={occupant.clothes}
          pose={studyPose ? "study1" : ownWalking || remoteWalking ? walkPose : "idle"}
          studyFurniture={studyFurniture || !studyPose}
          className={[
            ownWalking || remoteWalking ? "is-walking" : "",
            atTable ? "is-at-lobby-table" : "",
          ]
            .filter(Boolean)
            .join(" ") || undefined}
          alt=""
        />
      </span>
      <span className={studying ? "crew-room-status is-farming" : "crew-room-status"}>
        {studying ? "Aurafarming" : "Online"}
      </span>
    </>
  );

  return (
    <div
      className={[
        "room-pet-wrap",
        sitting ? "is-sitting" : "",
        draggingNow ? "is-dragging" : "",
        mine ? "" : "is-remote",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: `${spot.left}%`,
        top: `${spot.top}%`,
        // Sit just under the tabletop layer so the desk reads in front of the pet.
        zIndex: draggingNow ? ROOM_DRAG_Z : roomDepthZ(sitting ? spot.top : spot.top),
      }}
    >
      {mine ? (
        <button
          type="button"
          className="room-pet"
          aria-label={`Move ${occupant.displayName}`}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              dragging: false,
            };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            if (!drag.dragging) {
              if (!dragPastThreshold(drag.startX, drag.startY, event.clientX, event.clientY)) return;
              drag.dragging = true;
              draggingRef.current = true;
              setDragging(true);
              setSeatId(null);
            }
            place(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect().height);
          }}
          onPointerUp={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            finishDrag(event.currentTarget.getBoundingClientRect().height);
          }}
          onPointerCancel={() => {
            finishDrag(0);
          }}
        >
          {body}
        </button>
      ) : (
        <div className="room-pet">{body}</div>
      )}
    </div>
  );
}

export function CrewRoom({
  crewId,
  viewerId,
  mascot,
  occupants,
  viewerStudying = false,
  onOpenLeaderboard,
}: {
  crewId: string;
  viewerId: string;
  mascot: { petType: string; color: string | null };
  occupants: readonly CrewOccupant[];
  viewerStudying?: boolean;
  onOpenLeaderboard?: () => void;
}) {
  const roomRef = useRef<HTMLDivElement>(null);
  const { poses, loaded, error, publish } = useCrewPoses(crewId);
  const taken = useMemo(() => {
    const seats = new Set<string>();
    for (const pose of Object.values(poses)) {
      if (pose.userId === viewerId) continue;
      if (pose.mode === "sitting" && pose.seatId) seats.add(pose.seatId);
    }
    return seats;
  }, [poses, viewerId]);

  const occupiedTables = useMemo(() => {
    const ids = new Set<string>();
    for (const pose of Object.values(poses)) {
      if (pose.mode === "sitting" && pose.seatId) ids.add(pose.seatId);
    }
    return ids;
  }, [poses]);

  const studyingTables = useMemo(() => {
    const ids = new Set<string>();
    for (const occupant of occupants) {
      if (!crewShowsAurafarming(occupant, viewerId, viewerStudying)) continue;
      const pose = poses[occupant.farmerId];
      if (pose?.mode === "sitting" && pose.seatId) ids.add(pose.seatId);
    }
    return ids;
  }, [occupants, poses, viewerId, viewerStudying]);

  return (
    <div className="living-room crew-room" ref={roomRef}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="living-room-art" src={CREW_LIBRARY_PATH} alt="" draggable={false} />
      {onOpenLeaderboard ? (
        <svg
          className="living-room-wall-hotspots"
          viewBox="0 0 600 300"
          preserveAspectRatio="xMidYMid meet"
          style={{ zIndex: 210 }}
        >
          <rect
            className="room-rack-hotspot"
            role="button"
            tabIndex={0}
            aria-label="Leaderboard"
            x={CREW_BLACKBOARD.x}
            y={CREW_BLACKBOARD.y}
            width={CREW_BLACKBOARD.width}
            height={CREW_BLACKBOARD.height}
            onClick={onOpenLeaderboard}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenLeaderboard();
              }
            }}
          />
        </svg>
      ) : null}
      {CREW_SEATS.map((seat) => {
        const occupied = occupiedTables.has(seat.id);
        const farming = studyingTables.has(seat.id);
        const depth = roomDepthZ(seat.anchor.top);
        // Chair back stays behind the pet. The desktop stays in front while someone sits.
        const backZ = depth - 1;
        const topZ = depth + (occupied ? 3 : 0);
        return (
          <span key={seat.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="crew-lobby-table"
              src={CREW_CHAIR_BACK_PATH}
              alt=""
              draggable={false}
              data-chair={seat.id}
              style={{
                left: `${seat.anchor.left}%`,
                top: `${seat.anchor.top}%`,
                zIndex: backZ,
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={["crew-lobby-table", occupied ? "is-occupied" : "", farming ? "is-studying" : ""]
                .filter(Boolean)
                .join(" ")}
              src={CREW_TABLE_PATH}
              alt=""
              draggable={false}
              data-table={seat.id}
              style={{
                left: `${seat.anchor.left}%`,
                top: `${seat.anchor.top}%`,
                zIndex: topZ,
              }}
            />
          </span>
        );
      })}
      <div className="living-room-pets">
        <div
          className="room-pet-wrap is-sitting is-remote"
          style={{
            left: `${CREW_PEDESTAL.left}%`,
            top: `${CREW_PEDESTAL.top}%`,
            zIndex: roomDepthZ(CREW_PEDESTAL.top),
          }}
          aria-label="FarmCrew pet"
        >
          <div className="room-pet">
            <span className="room-pet-sprite">
              <PixelPetArt petType={mascot.petType} color={mascot.color} pose="idle" alt="" />
            </span>
          </div>
        </div>
        {occupants.map((occupant) => (
          <CrewFarmer
            key={occupant.farmerId}
            occupant={occupant}
            viewerId={viewerId}
            pose={poses[occupant.farmerId]}
            loaded={loaded}
            taken={taken}
            roomRef={roomRef}
            publish={publish}
            viewerStudying={viewerStudying}
          />
        ))}
      </div>
      {error ? (
        <div className="room-empty">
          <p>{error}</p>
        </div>
      ) : occupants.length === 0 ? (
        <div className="room-empty">
          <p>Nobody is in the crew room right now.</p>
        </div>
      ) : null}
    </div>
  );
}
