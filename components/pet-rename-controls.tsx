"use client";

import { useState, type FormEvent } from "react";
import { renamePet } from "@/lib/actions/pets";
import { petDisplayName, type PetCard } from "@/lib/pets";
import { RENAME_COUPON_ICON, RENAME_PET_NAME_MAX } from "@/lib/rename-coupon";

export function RenameExchangeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M3 5h7.2l-1.1-1.1 1.1-1.1L14 5.5 10.2 9.3 9.1 8.2 10.2 7H3V5zm10 6H5.8l1.1 1.1-1.1 1.1L2 10.5 5.8 6.7 6.9 7.8 5.8 9H13v2z"
      />
    </svg>
  );
}

export function PetRenameCircleButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="pet-rename-circle"
      aria-label="Rename"
      disabled={disabled}
      onClick={onClick}
    >
      <RenameExchangeIcon />
    </button>
  );
}

export function PetRenameForm({
  pet,
  renameCoupons,
  pending,
  onPendingChange,
  onError,
  onRenamed,
  onCancel,
}: {
  pet: PetCard;
  renameCoupons: number;
  pending?: boolean;
  onPendingChange?: (pending: boolean) => void;
  onError?: (error: string | null) => void;
  onRenamed: (name: string) => void;
  onCancel: () => void;
}) {
  const [draftName, setDraftName] = useState(petDisplayName(pet));
  const busy = Boolean(pending);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || renameCoupons < 1) return;
    onPendingChange?.(true);
    onError?.(null);
    const result = await renamePet(pet.id, draftName);
    onPendingChange?.(false);
    if (result.error) {
      onError?.(result.error);
      return;
    }
    onRenamed(result.name ?? draftName.trim());
  }

  return (
    <form className="pet-rename-form" onSubmit={onSubmit}>
      <label className="field">
        <span>New name</span>
        <input
          type="text"
          value={draftName}
          maxLength={RENAME_PET_NAME_MAX}
          autoFocus
          disabled={busy}
          onChange={(event) => setDraftName(event.target.value)}
        />
      </label>
      <div className="tracker-actions">
        <button type="button" className="button button-ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="button pet-rename-spend"
          disabled={busy || renameCoupons < 1}
          aria-label="Confirm rename, spend one coupon"
        >
          <span aria-hidden="true">-1</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={RENAME_COUPON_ICON} alt="" width={22} height={22} draggable={false} />
        </button>
      </div>
    </form>
  );
}
