export type MacDesktopSignals = {
  uaPlatform?: string;
  userAgent?: string;
  maxTouchPoints?: number;
};

export function macDesktopSupported(signals: MacDesktopSignals) {
  if (signals.uaPlatform) return signals.uaPlatform === "macOS";
  const ua = signals.userAgent ?? "";
  const touches = signals.maxTouchPoints ?? 0;
  if (/iPhone|iPad|iPod/.test(ua)) return false;
  if (touches > 1 && /Macintosh|Mac OS/.test(ua)) return false;
  return /Macintosh|Mac OS X/.test(ua);
}

export function readMacDesktop() {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return macDesktopSupported({
    uaPlatform: uaData?.platform,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

let cachedMacDesktop: boolean | null = null;

export function subscribeMacDesktop() {
  return () => {};
}

export function macDesktopSnapshot() {
  if (cachedMacDesktop === null && typeof navigator !== "undefined") cachedMacDesktop = readMacDesktop();
  return cachedMacDesktop;
}

export function macDesktopServerSnapshot() {
  return null;
}
