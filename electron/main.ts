import { app, BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ipcMain } from 'electron'
import crypto from 'node:crypto'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config({ path: path.join(process.env.APP_ROOT || '', '.env') });

// Get sensitive information from environment variables
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:5173/callback';

// Verify required environment variables
if (!SPOTIFY_CLIENT_ID) {
  console.error('ERROR: Missing SPOTIFY_CLIENT_ID environment variable');
  console.error('Please create a .env file with your Spotify API credentials');
  console.error('See .env.example for the required format');
  app.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let codeVerifier: string | null = null;
let isLoginInProgress = false;

function logToConsole(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function base64URLEncode(str: Buffer) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function getPKCECodes() {
  const code_verifier = base64URLEncode(crypto.randomBytes(32));
  const code_challenge = base64URLEncode(crypto
    .createHash('sha256')
    .update(code_verifier)
    .digest());
  return { code_verifier, code_challenge };
}

function createWindow() {
  win = new BrowserWindow({
    title: 'pomodoroTimer',
    width: 1300,
    height: 800,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  ipcMain.on('resize-window', (event, which) => {
    if (!win) {
      return;
    }
    switch (which) {
      case 0:
        win.setSize(1300, 800);
        break;

      case 1:
        win.setSize(500, 80);
        break;

      case 2: {
        const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
        win.setSize(sw, sh);
        win.setPosition(0, 0);
        break;
      }

      default:
        console.warn('Unknown resize code:', which);
    }
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

// Spotify API handlers
ipcMain.handle('spotify-login', async () => {
  if (isLoginInProgress) {
    logToConsole('Login already in progress, ignoring request');
    return;
  }

  isLoginInProgress = true;

  const scopes = 'user-read-playback-state user-modify-playback-state';

  const { code_verifier, code_challenge } = getPKCECodes();
  codeVerifier = code_verifier;
  logToConsole('Generated PKCE codes');

  const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&code_challenge_method=S256&code_challenge=${code_challenge}`;
  logToConsole('Auth URL generated');

  return new Promise((resolve, reject) => {
    if (!win) {
      isLoginInProgress = false;
      logToConsole('Error: Main window not found');
      return reject(new Error('Main window not found'));
    }

    // Remove any existing redirect listeners
    win.webContents.removeAllListeners('will-redirect');
    win.webContents.removeAllListeners('will-navigate');

    // Use the main window for auth
    win.loadURL(authUrl);

    const handleRedirect = async (event: Electron.Event, url: string) => {
      logToConsole('Redirect detected');

      // Check if this is our callback URL
      if (url.startsWith(SPOTIFY_REDIRECT_URI)) {
        event.preventDefault();
        const code = new URL(url).searchParams.get('code');
        if (!code) {
          isLoginInProgress = false;
          logToConsole('Error: No code returned in redirect');
          return reject(new Error('No code returned'));
        }

        try {
          const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: SPOTIFY_CLIENT_ID,
              grant_type: 'authorization_code',
              code,
              redirect_uri: SPOTIFY_REDIRECT_URI,
              code_verifier: codeVerifier || '',
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            isLoginInProgress = false;
            logToConsole(`Error from Spotify API: ${JSON.stringify(errorData)}`);
            return reject(new Error(`Spotify API error: ${errorData.error_description || errorData.error}`));
          }

          const data = await response.json();
          if (data.access_token && data.refresh_token) {
            logToConsole('Successfully obtained tokens');
            // Load the app URL after successful authentication
            if (win) {
              if (VITE_DEV_SERVER_URL) {
                win.loadURL(VITE_DEV_SERVER_URL);
              } else {
                win.loadFile(path.join(RENDERER_DIST, 'index.html'));
              }
            }
            isLoginInProgress = false;
            resolve({
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              expiresIn: data.expires_in,
            });
          } else {
            isLoginInProgress = false;
            logToConsole('Error: Failed to retrieve tokens');
            reject(new Error('Failed to retrieve tokens'));
          }
        } catch (err) {
          isLoginInProgress = false;
          logToConsole(`Error during token exchange: ${err}`);
          reject(err);
        }
      }
    };

    // Handle navigation to login page
    const handleNavigation = (event: Electron.Event, url: string) => {
      logToConsole('Navigation detected');
      if (url.includes('accounts.spotify.com/login')) {
        // Allow navigation to login page
        event.preventDefault();
        win?.loadURL(url);
      }
    };

    win.webContents.on('will-redirect', handleRedirect);
    win.webContents.on('will-navigate', handleNavigation);

    // Add a timeout to prevent hanging
    const timeout = setTimeout(() => {
      if (isLoginInProgress) {
        isLoginInProgress = false;
        logToConsole('Login attempt timed out');
        reject(new Error('Login attempt timed out'));
      }
    }, 60000);

    // Clean up on window close
    win.on('closed', () => {
      clearTimeout(timeout);
      isLoginInProgress = false;
    });
  });
});

ipcMain.handle('refresh-token', async (_event, refreshToken: string) => {
  logToConsole('Starting token refresh...');

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: SPOTIFY_CLIENT_ID,
      }),
    });

    const data = await response.json();
    logToConsole('Token refresh completed');
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    logToConsole(`Error during token refresh: ${error}`);
    throw error;
  }
});

ipcMain.handle('exchange-code', async (event, code: string) => {
  if (!code) {
    throw new Error('No code provided');
  }

  if (!codeVerifier) {
    throw new Error('No code verifier available');
  }

  try {
    logToConsole('Starting token exchange with code verifier');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      logToConsole(`Error from Spotify API: ${JSON.stringify(errorData)}`);
      throw new Error(`Spotify API error: ${errorData.error_description || errorData.error}`);
    }

    const data = await response.json();
    if (data.access_token && data.refresh_token) {
      logToConsole('Successfully exchanged code for tokens');
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      };
    } else {
      throw new Error('Invalid token response');
    }
  } catch (error) {
    logToConsole(`Error during token exchange: ${error}`);
    throw error;
  } finally {
    // Clear the code verifier after use
    codeVerifier = null;
  }
});