"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ROOM_DECOR_CATEGORIES,
  decorOptions,
  equipRoomSkin,
  isRoomItemPlaced,
  roomSkinSrc,
  seatGroupPlaced,
  setRoomItemPlaced,
  setSeatGroupPlaced,
  skinOwned,
  type DecorOption,
  type RoomDecor,
  type RoomDecorCategoryId,
} from "@/lib/room-decor";

function previewStyle(crop: { x: number; y: number; width: number; height: number }) {
  const width = (600 / Math.max(crop.width, crop.height)) * 100;
  const height = width * 0.5;
  const left = 50 - ((crop.x + crop.width / 2) / 600) * width;
  const top = 50 - ((crop.y + crop.height / 2) / 300) * height;
  return { width: `${width}%`, height: `${height}%`, left: `${left}%`, top: `${top}%` };
}

function DecorArt({
  src,
  crop,
  alt,
}: {
  src: string;
  crop: { x: number; y: number; width: number; height: number } | null;
  alt: string;
}) {
  if (!crop) {
    return <img className="decor-art-fit" src={src} alt={alt} draggable={false} />;
  }
  return (
    <span className="decor-art-crop">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} draggable={false} style={previewStyle(crop)} />
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
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState("floor:base");
  const categories = ROOM_DECOR_CATEGORIES.filter((item) => item.sidebar !== false);
  const category = categories.find((item) => item.id === categoryId) ?? categories[0];
  const options = useMemo(() => decorOptions(category.id), [category.id]);
  const skins = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((skin) => skin.name.toLowerCase().includes(needle));
  }, [options, query]);
  const detail = options.find((skin) => skin.key === detailId) ?? skins[0] ?? options[0];
  const strips = category.id === "floor" || category.id === "trim" || category.id === "wall";

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
    setDetailId(skin.key);
    if (!skinOwned(skin.skinId)) return;
    const seat = skin.categoryId === "armchair" || skin.categoryId === "loveseat" || skin.categoryId === "sofa";
    if (seat && optionPlaced(skin)) {
      onChange(setRoomItemPlaced(decor, skin.categoryId, false));
      return;
    }
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
            {categories.map((item) => {
              const itemPlaced = item.id === "sofa" ? seatGroupPlaced(decor) : isRoomItemPlaced(decor, item.id);
              return (
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
                  {item.optional ? (
                    <button
                      type="button"
                      className="decor-cat-toggle"
                      aria-label={itemPlaced ? `Remove ${item.label}` : `Add ${item.label}`}
                      onClick={() =>
                        onChange(
                          item.id === "sofa"
                            ? setSeatGroupPlaced(decor, !itemPlaced)
                            : setRoomItemPlaced(decor, item.id, !itemPlaced),
                        )
                      }
                    >
                      {itemPlaced ? "−" : "+"}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="decor-grid-col">
            <label className="decor-search">
              <span className="sr-only">Search decorations</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search..."
                type="search"
              />
            </label>
            <div className={strips ? "decor-grid is-strips" : "decor-grid"}>
              {skins.length === 0 ? <p className="decor-empty">No decorations match.</p> : null}
              {skins.map((skin) => {
                const owned = skinOwned(skin.skinId);
                const equipped = optionPlaced(skin);
                return (
                  <button
                    key={skin.key}
                    type="button"
                    className={
                      strips
                        ? `decor-tile is-strip is-${category.id}${equipped ? " is-equipped" : ""}`
                        : equipped
                          ? "decor-tile is-equipped"
                          : "decor-tile"
                    }
                    aria-pressed={equipped}
                    onClick={() => chooseSkin(skin)}
                  >
                    {owned ? (
                      <DecorArt src={roomSkinSrc(skin.categoryId, skin.skinId)} crop={skin.crop} alt="" />
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
                  <DecorArt src={roomSkinSrc(detail.categoryId, detail.skinId)} crop={detail.crop} alt="" />
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
