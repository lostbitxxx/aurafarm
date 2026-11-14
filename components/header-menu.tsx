"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

const MOBILE_HEADER = "(max-width: 1120px)";

export function HeaderMenu({
  alert = false,
  children,
}: {
  alert?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia(MOBILE_HEADER);
    const previousOverflow = document.body.style.overflow;
    if (query.matches) document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    }

    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (toggleRef.current?.contains(target) || drawerRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onChange() {
      if (!query.matches) {
        document.body.style.overflow = previousOverflow;
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    query.addEventListener("change", onChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      query.removeEventListener("change", onChange);
    };
  }, [open]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className={open ? "topbar-menu-button is-open" : "topbar-menu-button"}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={
          alert
            ? open
              ? "Close menu, friend request waiting"
              : "Open menu, friend request waiting"
            : open
              ? "Close menu"
              : "Open menu"
        }
        onClick={() => setOpen((value) => !value)}
      >
        <span className="topbar-menu-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        {alert ? <span className="request-dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="topbar-scrim"
            tabIndex={-1}
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <nav
            ref={drawerRef}
            id={menuId}
            className="topbar-drawer"
            aria-label="Menu"
            onClick={(event) => {
              const control = (event.target as HTMLElement).closest("a, button");
              if (!control) return;
              if (control instanceof HTMLButtonElement && control.type === "submit") return;
              setOpen(false);
            }}
          >
            {children}
          </nav>
        </>
      ) : null}
    </>
  );
}
