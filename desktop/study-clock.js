/** Planned study time left, and the label the pet panel shows. */

function remainingStudyMs(current, now) {
  const planned = Number(current?.plannedSeconds);
  const started = Number(current?.startedAtMs);
  if (!Number.isFinite(planned) || planned <= 0 || !Number.isFinite(started)) return null;
  return started + planned * 1000 - now;
}

function studyProgress(current, now) {
  const remaining = remainingStudyMs(current, now);
  const planned = Number(current?.plannedSeconds);
  if (remaining === null || !Number.isFinite(planned) || planned <= 0) return null;
  const fraction = 1 - remaining / (planned * 1000);
  return Math.min(1, Math.max(0, fraction));
}

function formatStudyClock(remainingMs) {
  const total = Math.max(0, Math.ceil(Number(remainingMs) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

module.exports = {
  formatStudyClock,
  remainingStudyMs,
  studyProgress,
};
