import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  ipcRenderer: {
    on(...args: Parameters<typeof ipcRenderer.on>) {
      const [channel, listener] = args;
      return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
      const [channel, ...omit] = args;
      return ipcRenderer.off(channel, ...omit);
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
      const [channel, ...omit] = args;
      return ipcRenderer.send(channel, ...omit);
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
      const [channel, ...omit] = args;
      return ipcRenderer.invoke(channel, ...omit);
    },
  },
  resizeWindow: {
    resize: (which: number) => {
      ipcRenderer.send('resize-window', which);
    }
  },
  spotifyAPI: {
    login: () => {
      console.log('spotifyAPI login called');
      return ipcRenderer.invoke('spotify-login');
    },
    refreshToken: (refreshToken: string) => {
      console.log('spotifyAPI refreshToken called with', refreshToken);
      return ipcRenderer.invoke('refresh-token', refreshToken);
    },
    exchangeCode: (code: string) => {
      console.log('spotifyAPI exchangeCode called with', code);
      return ipcRenderer.invoke('exchange-code', code);
    },
  },
});
