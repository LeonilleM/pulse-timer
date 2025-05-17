import { app, BrowserWindow, ipcMain, screen } from "electron";
import path$1 from "node:path";
import { fileURLToPath } from "node:url";
import crypto$1 from "node:crypto";
import require$$0 from "fs";
import require$$1 from "path";
import require$$2 from "os";
import require$$3 from "crypto";
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var main = { exports: {} };
const version$1 = "16.5.0";
const require$$4 = {
  version: version$1
};
const fs = require$$0;
const path = require$$1;
const os = require$$2;
const crypto = require$$3;
const packageJson = require$$4;
const version = packageJson.version;
const LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
function parse(src) {
  const obj = {};
  let lines = src.toString();
  lines = lines.replace(/\r\n?/mg, "\n");
  let match;
  while ((match = LINE.exec(lines)) != null) {
    const key = match[1];
    let value = match[2] || "";
    value = value.trim();
    const maybeQuote = value[0];
    value = value.replace(/^(['"`])([\s\S]*)\1$/mg, "$2");
    if (maybeQuote === '"') {
      value = value.replace(/\\n/g, "\n");
      value = value.replace(/\\r/g, "\r");
    }
    obj[key] = value;
  }
  return obj;
}
function _parseVault(options) {
  const vaultPath = _vaultPath(options);
  const result = DotenvModule.configDotenv({ path: vaultPath });
  if (!result.parsed) {
    const err = new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
    err.code = "MISSING_DATA";
    throw err;
  }
  const keys = _dotenvKey(options).split(",");
  const length = keys.length;
  let decrypted;
  for (let i = 0; i < length; i++) {
    try {
      const key = keys[i].trim();
      const attrs = _instructions(result, key);
      decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
      break;
    } catch (error) {
      if (i + 1 >= length) {
        throw error;
      }
    }
  }
  return DotenvModule.parse(decrypted);
}
function _warn(message) {
  console.log(`[dotenv@${version}][WARN] ${message}`);
}
function _debug(message) {
  console.log(`[dotenv@${version}][DEBUG] ${message}`);
}
function _dotenvKey(options) {
  if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
    return options.DOTENV_KEY;
  }
  if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
    return process.env.DOTENV_KEY;
  }
  return "";
}
function _instructions(result, dotenvKey) {
  let uri;
  try {
    uri = new URL(dotenvKey);
  } catch (error) {
    if (error.code === "ERR_INVALID_URL") {
      const err = new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
      err.code = "INVALID_DOTENV_KEY";
      throw err;
    }
    throw error;
  }
  const key = uri.password;
  if (!key) {
    const err = new Error("INVALID_DOTENV_KEY: Missing key part");
    err.code = "INVALID_DOTENV_KEY";
    throw err;
  }
  const environment = uri.searchParams.get("environment");
  if (!environment) {
    const err = new Error("INVALID_DOTENV_KEY: Missing environment part");
    err.code = "INVALID_DOTENV_KEY";
    throw err;
  }
  const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
  const ciphertext = result.parsed[environmentKey];
  if (!ciphertext) {
    const err = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
    err.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
    throw err;
  }
  return { ciphertext, key };
}
function _vaultPath(options) {
  let possibleVaultPath = null;
  if (options && options.path && options.path.length > 0) {
    if (Array.isArray(options.path)) {
      for (const filepath of options.path) {
        if (fs.existsSync(filepath)) {
          possibleVaultPath = filepath.endsWith(".vault") ? filepath : `${filepath}.vault`;
        }
      }
    } else {
      possibleVaultPath = options.path.endsWith(".vault") ? options.path : `${options.path}.vault`;
    }
  } else {
    possibleVaultPath = path.resolve(process.cwd(), ".env.vault");
  }
  if (fs.existsSync(possibleVaultPath)) {
    return possibleVaultPath;
  }
  return null;
}
function _resolveHome(envPath) {
  return envPath[0] === "~" ? path.join(os.homedir(), envPath.slice(1)) : envPath;
}
function _configVault(options) {
  const debug = Boolean(options && options.debug);
  if (debug) {
    _debug("Loading env from encrypted .env.vault");
  }
  const parsed = DotenvModule._parseVault(options);
  let processEnv = process.env;
  if (options && options.processEnv != null) {
    processEnv = options.processEnv;
  }
  DotenvModule.populate(processEnv, parsed, options);
  return { parsed };
}
function configDotenv(options) {
  const dotenvPath = path.resolve(process.cwd(), ".env");
  let encoding = "utf8";
  const debug = Boolean(options && options.debug);
  if (options && options.encoding) {
    encoding = options.encoding;
  } else {
    if (debug) {
      _debug("No encoding is specified. UTF-8 is used by default");
    }
  }
  let optionPaths = [dotenvPath];
  if (options && options.path) {
    if (!Array.isArray(options.path)) {
      optionPaths = [_resolveHome(options.path)];
    } else {
      optionPaths = [];
      for (const filepath of options.path) {
        optionPaths.push(_resolveHome(filepath));
      }
    }
  }
  let lastError;
  const parsedAll = {};
  for (const path2 of optionPaths) {
    try {
      const parsed = DotenvModule.parse(fs.readFileSync(path2, { encoding }));
      DotenvModule.populate(parsedAll, parsed, options);
    } catch (e) {
      if (debug) {
        _debug(`Failed to load ${path2} ${e.message}`);
      }
      lastError = e;
    }
  }
  let processEnv = process.env;
  if (options && options.processEnv != null) {
    processEnv = options.processEnv;
  }
  DotenvModule.populate(processEnv, parsedAll, options);
  if (lastError) {
    return { parsed: parsedAll, error: lastError };
  } else {
    return { parsed: parsedAll };
  }
}
function config(options) {
  if (_dotenvKey(options).length === 0) {
    return DotenvModule.configDotenv(options);
  }
  const vaultPath = _vaultPath(options);
  if (!vaultPath) {
    _warn(`You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`);
    return DotenvModule.configDotenv(options);
  }
  return DotenvModule._configVault(options);
}
function decrypt(encrypted, keyStr) {
  const key = Buffer.from(keyStr.slice(-64), "hex");
  let ciphertext = Buffer.from(encrypted, "base64");
  const nonce = ciphertext.subarray(0, 12);
  const authTag = ciphertext.subarray(-16);
  ciphertext = ciphertext.subarray(12, -16);
  try {
    const aesgcm = crypto.createDecipheriv("aes-256-gcm", key, nonce);
    aesgcm.setAuthTag(authTag);
    return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
  } catch (error) {
    const isRange = error instanceof RangeError;
    const invalidKeyLength = error.message === "Invalid key length";
    const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";
    if (isRange || invalidKeyLength) {
      const err = new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
      err.code = "INVALID_DOTENV_KEY";
      throw err;
    } else if (decryptionFailed) {
      const err = new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
      err.code = "DECRYPTION_FAILED";
      throw err;
    } else {
      throw error;
    }
  }
}
function populate(processEnv, parsed, options = {}) {
  const debug = Boolean(options && options.debug);
  const override = Boolean(options && options.override);
  if (typeof parsed !== "object") {
    const err = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
    err.code = "OBJECT_REQUIRED";
    throw err;
  }
  for (const key of Object.keys(parsed)) {
    if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
      if (override === true) {
        processEnv[key] = parsed[key];
      }
      if (debug) {
        if (override === true) {
          _debug(`"${key}" is already defined and WAS overwritten`);
        } else {
          _debug(`"${key}" is already defined and was NOT overwritten`);
        }
      }
    } else {
      processEnv[key] = parsed[key];
    }
  }
}
const DotenvModule = {
  configDotenv,
  _configVault,
  _parseVault,
  config,
  decrypt,
  parse,
  populate
};
main.exports.configDotenv = DotenvModule.configDotenv;
main.exports._configVault = DotenvModule._configVault;
main.exports._parseVault = DotenvModule._parseVault;
main.exports.config = DotenvModule.config;
main.exports.decrypt = DotenvModule.decrypt;
main.exports.parse = DotenvModule.parse;
main.exports.populate = DotenvModule.populate;
main.exports = DotenvModule;
var mainExports = main.exports;
const dotenv = /* @__PURE__ */ getDefaultExportFromCjs(mainExports);
dotenv.config({ path: path$1.join(process.env.APP_ROOT || "", ".env") });
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:5173/callback";
if (!SPOTIFY_CLIENT_ID) {
  console.error("ERROR: Missing SPOTIFY_CLIENT_ID environment variable");
  console.error("Please create a .env file with your Spotify API credentials");
  console.error("See .env.example for the required format");
  app.exit(1);
}
const __dirname = path$1.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path$1.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let codeVerifier = null;
let isLoginInProgress = false;
function logToConsole(message) {
  console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}`);
}
function base64URLEncode(str) {
  return str.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function getPKCECodes() {
  const code_verifier = base64URLEncode(crypto$1.randomBytes(32));
  const code_challenge = base64URLEncode(crypto$1.createHash("sha256").update(code_verifier).digest());
  return { code_verifier, code_challenge };
}
function createWindow() {
  win = new BrowserWindow({
    title: "pomodoroTimer",
    width: 1300,
    height: 800,
    alwaysOnTop: true,
    webPreferences: {
      preload: path$1.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  ipcMain.on("resize-window", (event, which) => {
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
        console.warn("Unknown resize code:", which);
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path$1.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
ipcMain.handle("spotify-login", async () => {
  if (isLoginInProgress) {
    logToConsole("Login already in progress, ignoring request");
    return;
  }
  isLoginInProgress = true;
  const scopes = "user-read-playback-state user-modify-playback-state";
  const { code_verifier, code_challenge } = getPKCECodes();
  codeVerifier = code_verifier;
  logToConsole("Generated PKCE codes");
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&code_challenge_method=S256&code_challenge=${code_challenge}`;
  logToConsole("Auth URL generated");
  return new Promise((resolve, reject) => {
    if (!win) {
      isLoginInProgress = false;
      logToConsole("Error: Main window not found");
      return reject(new Error("Main window not found"));
    }
    win.webContents.removeAllListeners("will-redirect");
    win.webContents.removeAllListeners("will-navigate");
    win.loadURL(authUrl);
    const handleRedirect = async (event, url) => {
      logToConsole("Redirect detected");
      if (url.startsWith(SPOTIFY_REDIRECT_URI)) {
        event.preventDefault();
        const code = new URL(url).searchParams.get("code");
        if (!code) {
          isLoginInProgress = false;
          logToConsole("Error: No code returned in redirect");
          return reject(new Error("No code returned"));
        }
        try {
          const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: SPOTIFY_CLIENT_ID,
              grant_type: "authorization_code",
              code,
              redirect_uri: SPOTIFY_REDIRECT_URI,
              code_verifier: codeVerifier || ""
            })
          });
          if (!response.ok) {
            const errorData = await response.json();
            isLoginInProgress = false;
            logToConsole(`Error from Spotify API: ${JSON.stringify(errorData)}`);
            return reject(new Error(`Spotify API error: ${errorData.error_description || errorData.error}`));
          }
          const data = await response.json();
          if (data.access_token && data.refresh_token) {
            logToConsole("Successfully obtained tokens");
            if (win) {
              if (VITE_DEV_SERVER_URL) {
                win.loadURL(VITE_DEV_SERVER_URL);
              } else {
                win.loadFile(path$1.join(RENDERER_DIST, "index.html"));
              }
            }
            isLoginInProgress = false;
            resolve({
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              expiresIn: data.expires_in
            });
          } else {
            isLoginInProgress = false;
            logToConsole("Error: Failed to retrieve tokens");
            reject(new Error("Failed to retrieve tokens"));
          }
        } catch (err) {
          isLoginInProgress = false;
          logToConsole(`Error during token exchange: ${err}`);
          reject(err);
        }
      }
    };
    const handleNavigation = (event, url) => {
      logToConsole("Navigation detected");
      if (url.includes("accounts.spotify.com/login")) {
        event.preventDefault();
        win == null ? void 0 : win.loadURL(url);
      }
    };
    win.webContents.on("will-redirect", handleRedirect);
    win.webContents.on("will-navigate", handleNavigation);
    const timeout = setTimeout(() => {
      if (isLoginInProgress) {
        isLoginInProgress = false;
        logToConsole("Login attempt timed out");
        reject(new Error("Login attempt timed out"));
      }
    }, 6e4);
    win.on("closed", () => {
      clearTimeout(timeout);
      isLoginInProgress = false;
    });
  });
});
ipcMain.handle("refresh-token", async (_event, refreshToken) => {
  logToConsole("Starting token refresh...");
  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: SPOTIFY_CLIENT_ID
      })
    });
    const data = await response.json();
    logToConsole("Token refresh completed");
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in
    };
  } catch (error) {
    logToConsole(`Error during token refresh: ${error}`);
    throw error;
  }
});
ipcMain.handle("exchange-code", async (event, code) => {
  if (!code) {
    throw new Error("No code provided");
  }
  if (!codeVerifier) {
    throw new Error("No code verifier available");
  }
  try {
    logToConsole("Starting token exchange with code verifier");
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: "authorization_code",
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_verifier: codeVerifier
      })
    });
    if (!response.ok) {
      const errorData = await response.json();
      logToConsole(`Error from Spotify API: ${JSON.stringify(errorData)}`);
      throw new Error(`Spotify API error: ${errorData.error_description || errorData.error}`);
    }
    const data = await response.json();
    if (data.access_token && data.refresh_token) {
      logToConsole("Successfully exchanged code for tokens");
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in
      };
    } else {
      throw new Error("Invalid token response");
    }
  } catch (error) {
    logToConsole(`Error during token exchange: ${error}`);
    throw error;
  } finally {
    codeVerifier = null;
  }
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
