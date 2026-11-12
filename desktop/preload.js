const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pet", {
  setPointerInside: (inside) => ipcRenderer.send("pointer-inside", inside),
  togglePanel: () => ipcRenderer.send("toggle-panel"),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("state", listener);
    return () => ipcRenderer.removeListener("state", listener);
  },
  signIn: (email, password) => ipcRenderer.invoke("sign-in", { email, password }),
  useToken: (token) => ipcRenderer.invoke("use-token", token),
  claim: (code) => ipcRenderer.invoke("claim", code),
  finish: () => ipcRenderer.send("finish-session"),
  cancelStudy: () => ipcRenderer.invoke("cancel-study"),
  openUpdate: () => ipcRenderer.send("open-update"),
  quit: () => ipcRenderer.send("quit-app"),
});
