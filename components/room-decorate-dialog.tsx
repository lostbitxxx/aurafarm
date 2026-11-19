"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ROOM_DECOR_CATEGORIES,
  decorOptions,
  equipRoomSkin,
  isRoomItemPlaced,
  roomSkinSrc,
  skinOwned,
  type DecorOption,
  type RoomDecor,
  type RoomDecorCategoryId,
} from "@/lib/room-decor";

function previewStyle(
  crop: { x: number; y: number; width: number; height: number },
  /** Expand the viewed region so tall pieces (lamp, shelf) fit with margin. */
  pad = 0,
) {
  const viewW = crop.width * (1 + pad * 2);
  const viewH = crop.height * (1 + pad * 2);
  const cx = (crop.x + crop.width / 2) / 600;
  const cy = (crop.y + crop.height / 2) / 300;
  // Size by width; height:auto keeps the 2:1 sheet. Center the crop with
  // translate so a non-square frame does not shift the piece up/down.
  const width = (600 / Math.max(viewW, viewH)) * 100;
  return {
    width: `${width}%`,
    height: "auto",
    left: "50%",
    top: "50%",
    transform: `translate(${(0.5 - cx) * 100 - 50}%, ${(0.5 - cy) * 100 - 50}%)`,
  };
}

function DecorArt({
  src,
  crop,
  alt,
  roomy = false,
}: {
  src: string;
  crop: { x: number; y: number; width: number; height: number } | null;
  alt: string;
  /** Detail preview: leave space around the piece without changing the frame box. */
  roomy?: boolean;
}) {
  if (!crop) {
    return <img className="decor-art-fit" src={src} alt={alt} draggable={false} />;
  }
  return (
    <span className="decor-art-crop">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} draggable={false} style={previewStyle(crop, roomy ? 0.35 : 0)} />
    </span>
  );
}

export function RoomDecorateDialog({
  decor,
  onChange,
  onClose,
}: {
  decor: RoomDecor;
  onChange: (next: RoomDecor) => void;
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState<RoomDecorCategoryId>("floor");
  const [detailId, setDetailId] = useState("floor:base");
  const categories = ROOM_DECOR_CATEGORIES.filter((item) => item.sidebar !== false);
  const category = categories.find((item) => item.id === categoryId) ?? categories[0];
  const options = useMemo(() => decorOptions(category.id), [category.id]);
  const detail = options.find((skin) => skin.key === detailId) ?? options[0];
  const strips = category.id === "floor" || category.id === "wall";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function chooseCategory(nextId: RoomDecorCategoryId) {
    const nextOptions = decorOptions(nextId);
    const equipped = nextOptions.find(
      (skin) => isRoomItemPlaced(decor, skin.categoryId) && decor.skins[skin.categoryId] === skin.skinId,
    );
    setCategoryId(nextId);
    setDetailId(equipped?.key ?? nextOptions[0]?.key ?? "floor:base");
  }

  function optionPlaced(skin: DecorOption) {
    return isRoomItemPlaced(decor, skin.categoryId) && decor.skins[skin.categoryId] === skin.skinId;
  }

  function chooseSkin(skin: DecorOption) {
    // First click previews; second click on the same owned skin equips.
    if (skin.key !== detailId) {
      setDetailId(skin.key);
      return;
    }
    if (!skinOwned(skin.skinId)) return;
    onChange(equipRoomSkin(decor, skin.categoryId, skin.skinId));
  }

  return (
    <div className="decor-pop" role="presentation" onMouseDown={onClose}>
      <div
        className="decor-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="decor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="decor-card-head">
          <h2 id="decor-title">Decorations</h2>
          <button type="button" className="decor-close" onClick={onClose} aria-label="Close decorations">
            Close
          </button>
        </header>
        <div className="decor-body">
          <div className="decor-cats" role="tablist" aria-label="Decoration types">
            {categories.map((item) => (
              <div key={item.id} className={item.id === category.id ? "decor-cat is-selected" : "decor-cat"}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={item.id === category.id}
                  className="decor-cat-main"
                  onClick={() => chooseCategory(item.id)}
                >
                  {item.label}
                </button>
              </div>
            ))}
          </div>
          <div className="decor-grid-col">
            <div className={strips ? "decor-grid is-strips" : "decor-grid"}>
              {options.length === 0 ? <p className="decor-empty">No decorations yet.</p> : null}
              {options.map((skin) => {
                const owned = skinOwned(skin.skinId);
                const equipped = optionPlaced(skin);
                const selected = skin.key === detail?.key;
                return (
                  <button
                    key={skin.key}
                    type="button"
                    className={
                      strips
                        ? `decor-tile is-strip is-${category.id}${equipped ? " is-equipped" : ""}${selected ? " is-selected" : ""}`
                        : `${equipped ? "decor-tile is-equipped" : "decor-tile"}${selected ? " is-selected" : ""}`
                    }
                    aria-pressed={equipped}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => chooseSkin(skin)}
                  >
                    {owned ? (
                      <DecorArt
                        src={roomSkinSrc(skin.categoryId, skin.skinId)}
                        crop={skin.crop}
                        alt=""
                        roomy
                      />
                    ) : (
                      <span className="decor-locked" aria-hidden="true">
                        ?
                      </span>
                    )}
                    <span className="sr-only">{owned ? skin.name : `${skin.name}, not obtained`}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {detail ? (
            <aside className="decor-detail">
              <div className={strips ? `decor-detail-frame is-strip is-${category.id}` : "decor-detail-frame"}>
                {skinOwned(detail.skinId) ? (
                  <DecorArt
                    src={roomSkinSrc(detail.categoryId, detail.skinId)}
                    crop={detail.crop}
                    alt=""
                    roomy
                  />
                ) : (
                  <span className="decor-locked" aria-hidden="true">
                    ?
                  </span>
                )}
              </div>
              <h3>{detail.name}</h3>
              <p className="decor-obtained">
                {skinOwned(detail.skinId) ? "Included with your room" : "Not obtained yet"}
              </p>
              <p className="decor-copy">{detail.description}</p>
              <div className="decor-dots" aria-hidden="true">
                {options.map((skin) => (
                  <i key={skin.key} className={skin.key === detail.key ? "is-on" : undefined} />
                ))}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
