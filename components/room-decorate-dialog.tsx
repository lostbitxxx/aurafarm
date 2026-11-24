"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { buyRoomSkin } from "@/lib/actions/room-decor";
import { COIN_ICON_SRC } from "@/lib/pet-assets";
import {
  ROOM_DECOR_CATEGORIES,
  decorOptions,
  equipRoomSkin,
  isRoomItemPlaced,
  roomSkinKey,
  roomSkinPrice,
  roomSkinSrc,
  skinOwned,
  type DecorOption,
  type RoomDecor,
  type RoomDecorCategoryId,
} from "@/lib/room-decor";

function CoinIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="coin-icon" src={COIN_ICON_SRC} alt="" draggable={false} />
  );
}

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
  blurred = false,
}: {
  src: string;
  crop: { x: number; y: number; width: number; height: number } | null;
  alt: string;
  /** Detail preview: leave space around the piece without changing the frame box. */
  roomy?: boolean;
  blurred?: boolean;
}) {
  const blurClass = blurred ? " is-blurred" : "";
  if (!crop) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={`decor-art-fit${blurClass}`} src={src} alt={alt} draggable={false} />
    );
  }
  return (
    <span className={`decor-art-crop${blurClass}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} draggable={false} style={previewStyle(crop, roomy ? 0.35 : 0)} />
    </span>
  );
}

export function RoomDecorateDialog({
  decor,
  coins,
  ownedSkinKeys,
  onChange,
  onCoinsChange,
  onOwnedSkinsChange,
  onClose,
}: {
  decor: RoomDecor;
  coins: number;
  ownedSkinKeys: ReadonlySet<string>;
  onChange: (next: RoomDecor) => void;
  onCoinsChange: (coins: number) => void;
  onOwnedSkinsChange: (keys: ReadonlySet<string>) => void;
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState<RoomDecorCategoryId>("floor");
  const [detailId, setDetailId] = useState("floor:base");
  const [buyError, setBuyError] = useState("");
  const [pending, startTransition] = useTransition();
  const categories = ROOM_DECOR_CATEGORIES.filter((item) => item.sidebar !== false);
  const category = categories.find((item) => item.id === categoryId) ?? categories[0];
  const options = useMemo(() => decorOptions(category.id), [category.id]);
  const detail = options.find((skin) => skin.key === detailId) ?? options[0];
  const strips = category.id === "floor" || category.id === "wall";

  function optionPlaced(skin: DecorOption) {
    return isRoomItemPlaced(decor, skin.categoryId) && decor.skins[skin.categoryId] === skin.skinId;
  }

  const detailOwned = detail ? skinOwned(detail.categoryId, detail.skinId, ownedSkinKeys) : false;
  const detailEquipped = detail ? optionPlaced(detail) : false;
  const detailPrice = detail ? roomSkinPrice(detail.categoryId, detail.skinId) : null;

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
    setBuyError("");
  }

  function chooseSkin(skin: DecorOption) {
    // Select for detail preview only; Buy / Equip buttons apply the change.
    setDetailId(skin.key);
    setBuyError("");
  }

  function onEquip() {
    if (!detail || !detailOwned) return;
    onChange(equipRoomSkin(decor, detail.categoryId, detail.skinId, ownedSkinKeys));
  }

  function onBuy() {
    if (!detail || detailOwned || detailPrice == null) return;
    setBuyError("");
    startTransition(async () => {
      const result = await buyRoomSkin(detail.categoryId, detail.skinId);
      if (result.error) {
        setBuyError(result.error);
        return;
      }
      const next = new Set(ownedSkinKeys);
      next.add(roomSkinKey(detail.categoryId, detail.skinId));
      if (detail.categoryId === "wall") {
        next.add(roomSkinKey("trim", detail.skinId));
      }
      onOwnedSkinsChange(next);
      if (typeof result.coins === "number") onCoinsChange(result.coins);
      else onCoinsChange(Math.max(0, coins - detailPrice));
    });
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
          <p className="decor-coins coin-balance" aria-live="polite" aria-label={`Coins ${coins}`}>
            <CoinIcon />
            <span>{coins}</span>
          </p>
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
                const owned = skinOwned(skin.categoryId, skin.skinId, ownedSkinKeys);
                const equipped = optionPlaced(skin);
                const selected = skin.key === detail?.key;
                const price = roomSkinPrice(skin.categoryId, skin.skinId);
                return (
                  <button
                    key={skin.key}
                    type="button"
                    className={
                      strips
                        ? `decor-tile is-strip is-${category.id}${equipped ? " is-equipped" : ""}${selected ? " is-selected" : ""}${owned ? "" : " is-locked"}`
                        : `${equipped ? "decor-tile is-equipped" : "decor-tile"}${selected ? " is-selected" : ""}${owned ? "" : " is-locked"}`
                    }
                    aria-pressed={equipped}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => chooseSkin(skin)}
                  >
                    <DecorArt
                      src={roomSkinSrc(skin.categoryId, skin.skinId)}
                      crop={skin.crop}
                      alt=""
                      roomy
                      blurred={!owned}
                    />
                    {owned ? (
                      <span className="decor-owned-tag" aria-hidden="true">
                        Owned
                      </span>
                    ) : price != null && price > 0 ? (
                      <span className="decor-price-tag" aria-hidden="true">
                        <CoinIcon />
                        {price}
                      </span>
                    ) : (
                      <span className="decor-locked" aria-hidden="true">
                        ?
                      </span>
                    )}
                    <span className="sr-only">
                      {owned
                        ? skin.name
                        : price != null && price > 0
                          ? `${skin.name}, ${price} coins`
                          : `${skin.name}, not obtained`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {detail ? (
            <aside className="decor-detail">
              <div
                className={
                  strips
                    ? `decor-detail-frame is-strip is-${category.id}${detailOwned ? "" : " is-locked"}`
                    : `decor-detail-frame${detailOwned ? "" : " is-locked"}`
                }
              >
                <DecorArt
                  src={roomSkinSrc(detail.categoryId, detail.skinId)}
                  crop={detail.crop}
                  alt=""
                  roomy
                  blurred={!detailOwned}
                />
                {!detailOwned ? (
                  detailPrice != null && detailPrice > 0 ? (
                    <span className="decor-price-tag" aria-hidden="true">
                      <CoinIcon />
                      {detailPrice}
                    </span>
                  ) : (
                    <span className="decor-locked" aria-hidden="true">
                      ?
                    </span>
                  )
                ) : null}
              </div>
              <h3>{detail.name}</h3>
              <p className="decor-obtained">
                {detail.skinId === "base" ? (
                  "Included with your room"
                ) : detailOwned ? (
                  "Owned"
                ) : detailPrice != null ? (
                  <span className="decor-price-line">
                    <CoinIcon />
                    {detailPrice}
                  </span>
                ) : (
                  "Not obtained yet"
                )}
              </p>
              <p className="decor-copy">{detail.description}</p>
              {detailOwned ? (
                <button
                  type="button"
                  className="decor-action"
                  disabled={detailEquipped}
                  onClick={onEquip}
                >
                  {detailEquipped ? "Equipped" : "Equip"}
                </button>
              ) : detailPrice != null ? (
                <button
                  type="button"
                  className="decor-action decor-action-buy"
                  disabled={pending || coins < detailPrice}
                  onClick={onBuy}
                >
                  {pending ? (
                    "…"
                  ) : (
                    <>
                      Buy · {detailPrice}
                      <CoinIcon />
                    </>
                  )}
                </button>
              ) : (
                <p className="decor-obtained">Not obtained yet</p>
              )}
              {buyError ? (
                <p className="form-error" role="alert">
                  {buyError}
                </p>
              ) : null}
              <div className="decor-dots" aria-hidden="true">
                {options.map((skin) => (
                  <i key={skin.key} className={skin.key === detail.key ? "is-on" : undefined} />
                ))}
              </div>
            </aside>
          ) : null}
        </div>
        <p className="decor-rate" aria-label="1min = 1coin">
          1min = 1
          <CoinIcon />
        </p>
      </div>
    </div>
  );
}
