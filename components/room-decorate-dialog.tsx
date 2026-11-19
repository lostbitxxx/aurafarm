"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ROOM_DECOR_CATEGORIES,
  equipRoomSkin,
  isRoomItemPlaced,
  roomSkinSrc,
  setRoomItemPlaced,
  skinOwned,
  type RoomDecor,
  type RoomDecorCategoryId,
  type RoomSkin,
} from "@/lib/room-decor";

function previewStyle(crop: { x: number; y: number; width: number; height: number }) {
  const width = (600 / Math.min(crop.width, crop.height)) * 100;
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
  const [detailId, setDetailId] = useState("base");
  const category = ROOM_DECOR_CATEGORIES.find((item) => item.id === categoryId) ?? ROOM_DECOR_CATEGORIES[0];
  const skins = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return category.skins;
    return category.skins.filter((skin) => skin.name.toLowerCase().includes(needle));
  }, [category.skins, query]);
  const detail = category.skins.find((skin) => skin.id === detailId) ?? skins[0] ?? category.skins[0];
  const placed = isRoomItemPlaced(decor, category.id);
  const equippedId = decor.skins[category.id];

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function chooseCategory(nextId: RoomDecorCategoryId) {
    const next = ROOM_DECOR_CATEGORIES.find((item) => item.id === nextId);
    setCategoryId(nextId);
    setDetailId(next ? decor.skins[next.id] : "base");
  }

  function chooseSkin(skin: RoomSkin) {
    setDetailId(skin.id);
    if (!skinOwned(skin.id)) return;
    onChange(equipRoomSkin(decor, category.id, skin.id));
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
            {ROOM_DECOR_CATEGORIES.map((item) => {
              const itemPlaced = isRoomItemPlaced(decor, item.id);
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
                      onClick={() => onChange(setRoomItemPlaced(decor, item.id, !itemPlaced))}
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
            <div className="decor-grid">
              {skins.length === 0 ? <p className="decor-empty">No decorations match.</p> : null}
              {skins.map((skin) => {
                const owned = skinOwned(skin.id);
                const equipped = placed && skin.id === equippedId;
                return (
                  <button
                    key={skin.id}
                    type="button"
                    className={equipped ? "decor-tile is-equipped" : "decor-tile"}
                    aria-pressed={equipped}
                    onClick={() => chooseSkin(skin)}
                  >
                    {owned ? (
                      <DecorArt src={roomSkinSrc(category.id, skin.id)} crop={category.crop} alt="" />
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
              <div className="decor-detail-frame">
                {skinOwned(detail.id) ? (
                  <DecorArt src={roomSkinSrc(category.id, detail.id)} crop={category.crop} alt="" />
                ) : (
                  <span className="decor-locked" aria-hidden="true">
                    ?
                  </span>
                )}
              </div>
              <h3>{detail.name}</h3>
              <p className="decor-obtained">
                {skinOwned(detail.id) ? "Included with your room" : "Not obtained yet"}
              </p>
              <p className="decor-copy">{detail.description}</p>
              <div className="decor-dots" aria-hidden="true">
                {category.skins.map((skin) => (
                  <i key={skin.id} className={skin.id === detail.id ? "is-on" : undefined} />
                ))}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
