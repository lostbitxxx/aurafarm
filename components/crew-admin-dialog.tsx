"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  acceptFarmCrewRequest,
  declineFarmCrewRequest,
  kickFarmCrewMember,
  loadFarmCrewMembers,
  promoteFarmCrewMember,
  updateFarmCrewSettings,
} from "@/lib/actions/farm-crew";
import type { FarmCrewDetail, FarmCrewJoinRequest, FarmCrewMember, FarmCrewRole } from "@/lib/farm-crew";
import { FarmDialog } from "./farm-dialog";
import { PixelPetArt } from "./pixel-pet";

type AdminTab = "general" | "members";

export function CrewAdminDialog({
  crew,
  viewerId,
  onClose,
  onCrewChange,
}: {
  crew: FarmCrewDetail;
  viewerId: string;
  onClose: () => void;
  onCrewChange: (crew: FarmCrewDetail) => void;
}) {
  const [tab, setTab] = useState<AdminTab>("general");
  const [name, setName] = useState(crew.name);
  const [description, setDescription] = useState(crew.description);
  const [visibility, setVisibility] = useState<"public" | "private">(crew.isPublic ? "public" : "private");
  const [members, setMembers] = useState<FarmCrewMember[]>([]);
  const [requests, setRequests] = useState<FarmCrewJoinRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "members") return;
    let stopped = false;
    setPending("members");
    void loadFarmCrewMembers(crew.crewId).then((result) => {
      if (stopped) return;
      setPending((current) => (current === "members" ? null : current));
      if (result.error) {
        setError(result.error);
        setMembers([]);
        setRequests([]);
        return;
      }
      setError(null);
      setMembers(result.members);
      setRequests(result.requests);
    });
    return () => {
      stopped = true;
    };
  }, [crew.crewId, tab]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending("save");
    setError(null);
    setNotice(null);
    const result = await updateFarmCrewSettings(crew.crewId, name, description, visibility);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    onCrewChange({
      ...crew,
      name: name.trim().replace(/\s+/g, " "),
      description: description.trim().replace(/\s+/g, " "),
      isPublic: visibility === "public",
    });
    setNotice("Saved.");
  }

  async function onPromote(member: FarmCrewMember) {
    if (pending) return;
    setPending(member.userId);
    setError(null);
    setNotice(null);
    const result = await promoteFarmCrewMember(crew.crewId, member.userId);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMembers((current) =>
      current.map((item) => (item.userId === member.userId ? { ...item, role: "admin" } : item)),
    );
  }

  async function onKick(member: FarmCrewMember) {
    if (pending) return;
    setPending(member.userId);
    setError(null);
    setNotice(null);
    const result = await kickFarmCrewMember(crew.crewId, member.userId);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMembers((current) => current.filter((item) => item.userId !== member.userId));
    onCrewChange({ ...crew, memberCount: Math.max(1, crew.memberCount - 1) });
  }

  async function onAccept(request: FarmCrewJoinRequest) {
    if (pending) return;
    setPending(request.userId);
    setError(null);
    setNotice(null);
    const result = await acceptFarmCrewRequest(crew.crewId, request.userId);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    const accepted: FarmCrewMember = {
      userId: request.userId,
      displayName: request.displayName,
      role: "member",
      petType: request.petType,
      color: request.color,
      hat: request.hat,
      clothes: request.clothes,
    };
    setRequests((current) => current.filter((item) => item.userId !== request.userId));
    setMembers((current) =>
      [...current, accepted].sort(
        (a, b) => roleOrder(a.role) - roleOrder(b.role) || a.displayName.localeCompare(b.displayName),
      ),
    );
    onCrewChange({ ...crew, memberCount: crew.memberCount + 1 });
  }

  async function onDecline(request: FarmCrewJoinRequest) {
    if (pending) return;
    setPending(request.userId);
    setError(null);
    setNotice(null);
    const result = await declineFarmCrewRequest(crew.crewId, request.userId);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRequests((current) => current.filter((item) => item.userId !== request.userId));
  }

  return (
    <FarmDialog title="Admin" onClose={onClose} wide>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="collection-tabs" role="tablist" aria-label="FarmCrew admin">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "general"}
          className={tab === "general" ? "button button-small" : "button button-small button-ghost"}
          onClick={() => {
            setTab("general");
            setError(null);
          }}
        >
          General
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "members"}
          className={tab === "members" ? "button button-small" : "button button-small button-ghost"}
          onClick={() => {
            setTab("members");
            setError(null);
            setNotice(null);
          }}
        >
          Members
        </button>
      </div>
      {tab === "general" ? (
        <form className="crew-create-form" onSubmit={onSave}>
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="FarmCrew name"
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
                  name="admin-crew-visibility"
                  value="public"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                />
                Public
              </label>
              <label>
                <input
                  type="radio"
                  name="admin-crew-visibility"
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
            {pending === "save" ? "Saving…" : "Save"}
          </button>
          {notice ? <p className="panel-hint">{notice}</p> : null}
        </form>
      ) : (
        <div className="collection-panel" role="tabpanel">
          {pending === "members" && members.length === 0 && requests.length === 0 ? (
            <p className="panel-hint">Loading members…</p>
          ) : null}
          <p className="crew-roster-heading">Join requests</p>
          {requests.length > 0 ? (
            <ul className="dialog-list">
              {requests.map((request) => (
                <li key={request.userId} className="dialog-row">
                  <MemberPet person={request} />
                  <div className="crew-copy">
                    <strong>{request.displayName}</strong>
                    <span className="panel-hint">Wants to join</span>
                  </div>
                  <div className="dialog-row-actions">
                    <button
                      type="button"
                      className="button button-small button-accept"
                      disabled={pending !== null}
                      onClick={() => void onAccept(request)}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="button button-small button-decline"
                      disabled={pending !== null}
                      onClick={() => void onDecline(request)}
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : pending === "members" ? null : (
            <p className="panel-hint">No incoming requests.</p>
          )}
          <p className="crew-roster-heading">Members</p>
          {members.length > 0 ? (
            <ul className="dialog-list">
              {members.map((member) => {
                const promote = member.role === "member";
                const kick = canRemove(crew.role, member, viewerId);
                return (
                  <li key={member.userId} className="dialog-row">
                    <MemberPet person={member} />
                    <div className="crew-copy">
                      <strong>
                        {member.displayName}
                        {member.userId === viewerId ? " (you)" : ""}
                      </strong>
                      <span className="panel-hint">{roleLabel(member.role)}</span>
                    </div>
                    {promote || kick ? (
                      <div className="dialog-row-actions">
                        {promote ? (
                          <button
                            type="button"
                            className="button button-small"
                            disabled={pending !== null}
                            onClick={() => void onPromote(member)}
                          >
                            Promote
                          </button>
                        ) : null}
                        {kick ? (
                          <button
                            type="button"
                            className="button button-small button-ghost"
                            disabled={pending !== null}
                            onClick={() => void onKick(member)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : pending === "members" ? null : (
            <p className="panel-hint">No members to show.</p>
          )}
        </div>
      )}
    </FarmDialog>
  );
}

function MemberPet({
  person,
}: {
  person: { petType: string | null; color: string | null; hat: string | null; clothes: string | null };
}) {
  if (!person.petType) {
    return <span className="dialog-pet-art friend-pet-missing" aria-hidden="true" />;
  }
  return (
    <PixelPetArt
      petType={person.petType}
      color={person.color}
      hat={person.hat}
      clothes={person.clothes}
      className="dialog-pet-art"
      alt=""
    />
  );
}

function roleOrder(role: FarmCrewRole) {
  if (role === "owner") return 0;
  if (role === "admin") return 1;
  return 2;
}

function roleLabel(role: FarmCrewRole) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

function canRemove(viewerRole: FarmCrewRole, member: FarmCrewMember, viewerId: string) {
  if (member.userId === viewerId || member.role === "owner") return false;
  if (viewerRole === "owner") return member.role === "admin" || member.role === "member";
  return viewerRole === "admin" && member.role === "member";
}
