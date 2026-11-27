const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pet", {
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("state", listener);
    return () => ipcRenderer.removeListener("state", listener);
  },
  signIn: (email, password) => ipcRenderer.invoke("sign-in", { email, password }),
  claim: (code) => ipcRenderer.invoke("claim", code),
  finish: () => ipcRenderer.send("finish-session"),
  cancelStudy: () => ipcRenderer.invoke("cancel-study"),
  openUpdate: () => ipcRenderer.send("open-update"),
  openDesk: () => ipcRenderer.send("open-desk"),
  quit: () => ipcRenderer.send("quit-app"),
  setOpen: (open) => ipcRenderer.send("set-panel-open", open),
  cancelSessionIntroCollapse: () => ipcRenderer.send("cancel-session-intro-collapse"),
  setIgnoreMouse: (ignore) => ipcRenderer.send("pet-ignore-mouse", Boolean(ignore)),
  dockDragStart: (x, y) => ipcRenderer.send("dock-drag-start", { x, y }),
  dockDragMove: (x, y) => ipcRenderer.send("dock-drag-move", { x, y }),
  dockDragEnd: (x, y) => ipcRenderer.send("dock-drag-end", { x, y }),
  dockDragCancel: () => ipcRenderer.send("dock-drag-cancel"),
});
