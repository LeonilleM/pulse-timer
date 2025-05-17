"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  ipcRenderer: {
    on(...args) {
      const [channel, listener] = args;
      return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
    },
    off(...args) {
      const [channel, ...omit] = args;
      return electron.ipcRenderer.off(channel, ...omit);
    },
    send(...args) {
      const [channel, ...omit] = args;
      return electron.ipcRenderer.send(channel, ...omit);
    },
    invoke(...args) {
      const [channel, ...omit] = args;
      return electron.ipcRenderer.invoke(channel, ...omit);
    }
  },
  resizeWindow: {
    resize: (which) => {
      electron.ipcRenderer.send("resize-window", which);
    }
  },
  spotifyAPI: {
    login: () => {
      console.log("spotifyAPI login called");
      return electron.ipcRenderer.invoke("spotify-login");
    },
    refreshToken: (refreshToken) => {
      console.log("spotifyAPI refreshToken called with", refreshToken);
      return electron.ipcRenderer.invoke("refresh-token", refreshToken);
    },
    exchangeCode: (code) => {
      console.log("spotifyAPI exchangeCode called with", code);
      return electron.ipcRenderer.invoke("exchange-code", code);
    }
  }
});
