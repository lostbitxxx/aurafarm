/** The open desk tab listens on this channel. The score tab posts here before it closes. */
export const DESK_REFRESH_CHANNEL = "aurafarm-desk";

export const DESK_REFRESH_TYPE = "refresh";

export function requestDeskRefresh() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(DESK_REFRESH_CHANNEL);
  channel.postMessage({ type: DESK_REFRESH_TYPE });
  channel.close();
}
