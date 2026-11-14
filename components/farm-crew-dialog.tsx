"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  acceptFarmCrewRequest,
  createFarmCrew,
  declineFarmCrewRequest,
  loadFarmCrewDialog,
  requestFarmCrewByCode,
  requestPublicFarmCrew,
} from "@/lib/actions/farm-crew";
import type { FarmCrewCard, FarmCrewRequest, PublicFarmCrewCard } from "@/lib/farm-crew";
import { FarmDialog } from "./farm-dialog";
import { PixelPetArt } from "./pixel-pet";

type FarmCrewTab = "list" | "join" | "create";
type CrewVisibility = "public" | "private";

function memberLabel(count: number) {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

function CrewPet({ petType, color }: { petType: string; color: string | null }) {
  return <PixelPetArt petType={petType} color={color} className="dialog-pet-art" alt="" />;
}

export function FarmCrewDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<FarmCrewTab>("list");
  const [crews, setCrews] = useState<FarmCrewCard[]>([]);
  const [publicCrews, setPublicCrews] = useState<PublicFarmCrewCard[]>([]);
  const [requests, setRequests] = useState<FarmCrewRequest[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CrewVisibility>("public");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const result = await loadFarmCrewDialog();
    if (result.error) setError(result.error);
    setCrews(result.crews);
    setPublicCrews(result.publicCrews);
    setRequests(result.requests);
  }

  useEffect(() => {
    let stopped = false;
    async function first() {
      const result = await loadFarmCrewDialog();
      if (stopped) return;
      if (result.error) setError(result.error);
      setCrews(result.crews);
      setPublicCrews(result.publicCrews);
      setRequests(result.requests);
    }
    void first();
    return () => {
      stopped = true;
    };
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending("create");
    setError(null);
    setNotice(null);
    const result = await createFarmCrew(name, description, visibility);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setName("");
    setDescription("");
    setVisibility("public");
    setTab("list");
    setNotice("FarmCrew created.");
    await load();
  }

  async function onCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending("code");
    setError(null);
    setNotice(null);
    const result = await requestFarmCrewByCode(code);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCode("");
    setNotice(`Request sent to ${result.crewName}.`);
    await load();
  }

  async function onRequest(crewId: string) {
    if (pending) return;
    setPending(crewId);
    setError(null);
    setNotice(null);
    const result = await requestPublicFarmCrew(crewId);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNotice(`Request sent to ${result.crewName}.`);
    await load();
  }

  async function onAccept(request: FarmCrewRequest) {
    if (pending) return;
    const key = `${request.crewId}:${request.userId}`;
    setPending(key);
    setError(null);
    const result = await acceptFarmCrewRequest(request.crewId, request.userId);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    await load();
  }

  async function onDecline(request: FarmCrewRequest) {
    if (pending) return;
    const key = `${request.crewId}:${request.userId}`;
    setPending(key);
    setError(null);
    const result = await declineFarmCrewRequest(request.crewId, request.userId);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    await load();
  }

  async function onCopy(crewCode: string) {
    try {
      await navigator.clipboard.writeText(crewCode);
      setCopied(crewCode);
    } catch {
      setError("The code could not be copied.");
    }
  }

  return (
    <FarmDialog title="FarmCrew" onClose={onClose} wide>
      <div className="collection-tabs" role="tablist" aria-label="FarmCrew">
        <button
          type="button"
          role="tab"
          id="crew-tab-list"
          aria-selected={tab === "list"}
          className={tab === "list" ? "button button-small" : "button button-small button-ghost"}
          onClick={() => {
            setTab("list");
            void load();
          }}
        >
          FarmCrew List
        </button>
        <button
          type="button"
          role="tab"
          id="crew-tab-join"
          aria-selected={tab === "join"}
          className={tab === "join" ? "button button-small" : "button button-small button-ghost"}
          onClick={() => setTab("join")}
        >
          Join FarmCrew
        </button>
        <button
          type="button"
          role="tab"
          id="crew-tab-create"
          aria-selected={tab === "create"}
          className={tab === "create" ? "button button-small" : "button button-small button-ghost"}
          onClick={() => setTab("create")}
        >
          Create FarmCrew
        </button>
      </div>
      <div
        className="collection-panel friends-panel"
        role="tabpanel"
        aria-labelledby={tab === "list" ? "crew-tab-list" : tab === "join" ? "crew-tab-join" : "crew-tab-create"}
      >
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? <p className="panel-hint">{notice}</p> : null}
        {tab === "list" ? (
          <>
            {requests.length > 0 ? (
              <ul className="dialog-list">
                {requests.map((request) => (
                  <li key={`${request.crewId}:${request.userId}`} className="dialog-row">
                    <div className="crew-copy">
                      <strong>{request.displayName}</strong>
                      <span className="panel-hint">Wants to join {request.crewName}</span>
                    </div>
                    <div className="dialog-row-actions">
                      <button
                        type="button"
                        className="button button-small button-accept"
                        disabled={pending !== null}
                        onClick={() => onAccept(request)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="button button-small button-decline"
                        disabled={pending !== null}
                        onClick={() => onDecline(request)}
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {crews.length > 0 ? (
              <ul className="dialog-list">
                {crews.map((crew) => (
                  <li key={crew.crewId} className="dialog-row crew-row">
                    <CrewPet petType={crew.petType} color={crew.color} />
                    <div className="crew-copy">
                      <strong>{crew.name}</strong>
                      <span className="panel-hint">{memberLabel(crew.memberCount)}</span>
                      {crew.code ? (
                        <span className="crew-code-line">
                          <span className="friend-code">{crew.code}</span>
                          <button type="button" className="button button-small button-ghost" onClick={() => onCopy(crew.code)}>
                            {copied === crew.code ? "Copied" : "Copy"}
                          </button>
                        </span>
                      ) : null}
                    </div>
                    <Link href={`/farmcrew/${crew.crewId}`} className="button button-small">
                      Visit
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-hint">You have not joined a FarmCrew yet.</p>
            )}
          </>
        ) : null}
        {tab === "join" ? (
          <>
            <form className="friend-add-form" onSubmit={onCode}>
              <label className="field friend-code-field">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  aria-label="FarmCrew code"
                  placeholder="FarmCrew code"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={12}
                />
              </label>
              <button type="submit" className="button button-small" disabled={pending !== null}>
                Send Request
              </button>
            </form>
            {publicCrews.length > 0 ? (
              <ul className="dialog-list">
                {publicCrews.map((crew) => (
                  <li key={crew.crewId} className="dialog-row crew-row">
                    <CrewPet petType={crew.petType} color={crew.color} />
                    <div className="crew-copy">
                      <strong>{crew.name}</strong>
                      <span className="panel-hint">{memberLabel(crew.memberCount)}</span>
                      {crew.description ? <p className="panel-hint">{crew.description}</p> : null}
                    </div>
                    <button
                      type="button"
                      className="button button-small"
                      disabled={pending !== null || crew.requested}
                      onClick={() => onRequest(crew.crewId)}
                    >
                      {crew.requested ? "Requested" : "Request"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-hint">No public FarmCrews yet.</p>
            )}
          </>
        ) : null}
        {tab === "create" ? (
          <form className="crew-create-form" onSubmit={onCreate}>
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-label="FarmCrew name"
                placeholder="FarmCrew name"
                maxLength={32}
                required
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                aria-label="FarmCrew description"
                placeholder="What should new members know?"
                maxLength={200}
                rows={3}
              />
            </label>
            <fieldset className="crew-visibility">
              <legend>Visibility</legend>
              <div className="crew-visibility-options">
                <label>
                  <input
                    type="radio"
                    name="crew-visibility"
                    value="public"
                    checked={visibility === "public"}
                    onChange={() => setVisibility("public")}
                  />
                  Public
                </label>
                <label>
                  <input
                    type="radio"
                    name="crew-visibility"
                    value="private"
                    checked={visibility === "private"}
                    onChange={() => setVisibility("private")}
                  />
                  Private
                </label>
              </div>
            </fieldset>
            <p className="panel-hint">
              {visibility === "public"
                ? "Listed in Join FarmCrew. A code can still request to join."
                : "Hidden from Join FarmCrew. Members join with the code."}
            </p>
            <button type="submit" className="button" disabled={pending !== null}>
              {pending === "create" ? "Creating…" : "Create FarmCrew"}
            </button>
          </form>
        ) : null}
      </div>
    </FarmDialog>
  );
}
