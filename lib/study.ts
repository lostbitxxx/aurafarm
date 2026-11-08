export type BlocklistEntry = {
  host: string;
  label: string;
};

export type ActiveStudySession = {
  id: string;
  startedAt: string;
};

export type StudyScoreCard = {
  id: string;
  points: number;
  distracted: boolean;
  durationSeconds: number;
  blockedHosts: string[];
  createdAt: string;
};

const ACTIVE_SESSION_ERROR = "A study session is already running.";

export function startSessionDecision(activeCount: number) {
  if (activeCount > 0) return { error: ACTIVE_SESSION_ERROR };
  return { error: "" };
}

export function buildPetLaunchUrl(code: string) {
  const params = new URLSearchParams({ code });
  return `aurafarm://session?${params.toString()}`;
}

export function formatTimestamp(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(parsed);
}

export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}
