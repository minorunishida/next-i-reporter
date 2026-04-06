import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import getPort from "get-port";
import { app, BrowserWindow, dialog, ipcMain, nativeImage, safeStorage } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- 設定ストレージ ----

function settingsFilePath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function secretsFilePath() {
  return path.join(app.getPath("userData"), "secrets.enc");
}

function readSettings() {
  try {
    return JSON.parse(readFileSync(settingsFilePath(), "utf8"));
  } catch {
    return {};
  }
}

function writeSettings(data) {
  const p = settingsFilePath();
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data), "utf8");
}

function readSecrets() {
  try {
    return JSON.parse(readFileSync(secretsFilePath(), "utf8"));
  } catch {
    return {};
  }
}

function writeSecrets(data) {
  const p = secretsFilePath();
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data), "utf8");
}

/** safeStorage (Windows: DPAPI) で暗号化して保存 */
function setEncryptedValue(key, value) {
  if (!safeStorage.isEncryptionAvailable()) return false;
  const secrets = readSecrets();
  secrets[key] = safeStorage.encryptString(value).toString("base64");
  writeSecrets(secrets);
  return true;
}

/** safeStorage で復号して取得。失敗時は null */
function getEncryptedValue(key) {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const secrets = readSecrets();
  if (!secrets[key]) return null;
  try {
    return safeStorage.decryptString(Buffer.from(secrets[key], "base64"));
  } catch {
    return null;
  }
}

function deleteEncryptedValue(key) {
  const secrets = readSecrets();
  delete secrets[key];
  writeSecrets(secrets);
}

// ---- IPC ハンドラー ----

function setupIpcHandlers() {
  ipcMain.handle("settings:get", () => {
    const settings = readSettings();
    return {
      hasApiKey: Boolean(getEncryptedValue("OPENAI_API_KEY")),
      eprintCliPath: settings.EPRINT_CLI_PATH ?? "",
    };
  });

  ipcMain.handle("settings:save", (_, { apiKey, eprintCliPath } = {}) => {
    if (typeof apiKey === "string") {
      if (apiKey === "") {
        deleteEncryptedValue("OPENAI_API_KEY");
        delete process.env.OPENAI_API_KEY;
      } else {
        setEncryptedValue("OPENAI_API_KEY", apiKey);
        process.env.OPENAI_API_KEY = apiKey;
      }
    }
    if (typeof eprintCliPath === "string") {
      const s = readSettings();
      s.EPRINT_CLI_PATH = eprintCliPath;
      writeSettings(s);
      process.env.EPRINT_CLI_PATH = eprintCliPath;
    }
    logLine("settings:save completed");
    return { ok: true };
  });

  ipcMain.handle("dialog:open-file", async (_, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      ...options,
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("settings:restart-server", async () => {
    if (!app.isPackaged) {
      // 開発モードは Next.js dev が別プロセスで動いているため再起動不要
      return { ok: true, dev: true };
    }
    cleanupServer();
    packagedServerPort = await startNextStandalone();
    mainWindow?.loadURL(`http://127.0.0.1:${packagedServerPort}`);
    return { ok: true };
  });
}

// ---- .env 読み込み ----

/** 実行ファイルと同じディレクトリの .env（配布時）。開発時はカレントの .env / .env.local */
function loadEnvFiles() {
  if (app.isPackaged) {
    // ポータブル版: NSIS が「ユーザーがダブルクリックした .exe のあるフォルダ」を指す
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      dotenv.config({ path: path.join(process.env.PORTABLE_EXECUTABLE_DIR, ".env") });
    }
    const exeDir = path.dirname(app.getPath("exe"));
    dotenv.config({ path: path.join(exeDir, ".env") });
    logLine(
      `dotenv: PORTABLE_EXECUTABLE_DIR=${process.env.PORTABLE_EXECUTABLE_DIR ?? "(なし)"} OPENAI_API_KEY=${Boolean(process.env.OPENAI_API_KEY)}`,
    );
  } else {
    const root = process.cwd();
    dotenv.config({ path: path.join(root, ".env") });
    dotenv.config({ path: path.join(root, ".env.local"), override: true });
  }

  // safeStorage の値が最優先（設定画面で保存した値）
  const storedKey = getEncryptedValue("OPENAI_API_KEY");
  if (storedKey) {
    process.env.OPENAI_API_KEY = storedKey;
    logLine("dotenv: OPENAI_API_KEY loaded from safeStorage");
  }
  const storedSettings = readSettings();
  if (storedSettings.EPRINT_CLI_PATH) {
    process.env.EPRINT_CLI_PATH = storedSettings.EPRINT_CLI_PATH;
  }
}

function logPath() {
  return path.join(app.getPath("userData"), "next-i-reporter-startup.log");
}

function logLine(msg) {
  try {
    const p = logPath();
    mkdirSync(path.dirname(p), { recursive: true });
    appendFileSync(p, `[${new Date().toISOString()}] ${msg}\n`, "utf8");
  } catch {
    /* ログ不可でも起動は続ける */
  }
}

function standaloneRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone");
  }
  return path.join(process.cwd(), ".next", "standalone");
}

/** PATH 上の node.exe（あれば）。なければ null（Electron を Node として使う） */
function resolveNodeOnPath() {
  try {
    const cmd = process.platform === "win32" ? "where.exe" : "which";
    const r = spawnSync(cmd, ["node"], { encoding: "utf8", shell: process.platform === "win32" });
    if (r.status !== 0 || !r.stdout) return null;
    const line = r.stdout.trim().split(/\r?\n/)[0];
    return line && existsSync(line) ? line : null;
  } catch {
    return null;
  }
}

let serverProcess = null;
let mainWindow = null;
let packagedServerPort = null;

function waitForServerHttp(port, timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tryOnce = () => {
      if (Date.now() > deadline) {
        reject(new Error(`Next サーバーが ${timeoutMs}ms 以内に応答しませんでした (http://127.0.0.1:${port}/)`));
        return;
      }
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          setTimeout(tryOnce, 400);
        }
      });
      req.on("error", () => setTimeout(tryOnce, 400));
      req.setTimeout(3000, () => {
        req.destroy();
        setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

async function startNextStandalone() {
  const root = standaloneRoot();
  const serverJs = path.join(root, "server.js");

  logLine(`standaloneRoot=${root}`);
  logLine(`serverJs exists=${existsSync(serverJs)}`);

  if (!existsSync(serverJs)) {
    throw new Error(
      `server.js が見つかりません。\n${serverJs}\n\nElectron の再ビルド（npm run electron:build）が必要な可能性があります。`,
    );
  }

  const port = await getPort({ host: "127.0.0.1" });
  const nodeExe = resolveNodeOnPath();
  const useRealNode = Boolean(nodeExe);

  const childEnv = { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1", NODE_ENV: "production" };
  delete childEnv.ELECTRON_RUN_AS_NODE;

  const exe = useRealNode ? nodeExe : process.execPath;
  const args = [serverJs];
  if (!useRealNode) {
    childEnv.ELECTRON_RUN_AS_NODE = "1";
  }

  logLine(`spawn server: ${exe} ${args.join(" ")} (useRealNode=${useRealNode})`);

  serverProcess = spawn(exe, args, {
    cwd: root,
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  serverProcess.stdout?.on("data", (d) => logLine(`[next stdout] ${String(d).trimEnd()}`));
  serverProcess.stderr?.on("data", (d) => logLine(`[next stderr] ${String(d).trimEnd()}`));

  serverProcess.on("error", (err) => {
    logLine(`spawn error: ${err.message}`);
  });

  serverProcess.on("exit", (code, signal) => {
    logLine(`next process exit code=${code} signal=${signal}`);
  });

  await waitForServerHttp(port);
  return port;
}

function createWindow(url) {
  const iconPath = path.join(process.cwd(), "build", "icon.ico");
  const icon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;
  const preload = path.join(__dirname, "preload.cjs");
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload,
    },
  });
  mainWindow.loadURL(url);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function showFatal(title, err) {
  const text = err instanceof Error ? `${err.message}\n\n${err.stack ?? ""}` : String(err);
  logLine(`FATAL ${title}: ${text}`);
  try {
    dialog.showErrorBox(title, `${text}\n\nログ: ${logPath()}`);
  } catch {
    /* headless 等 */
  }
}

async function ready() {
  setupIpcHandlers();
  loadEnvFiles();

  if (!app.isPackaged) {
    createWindow("http://127.0.0.1:3000");
    return;
  }

  if (packagedServerPort == null) {
    packagedServerPort = await startNextStandalone();
  }
  createWindow(`http://127.0.0.1:${packagedServerPort}`);
}

function cleanupServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
}

app.whenReady().then(() => {
  ready().catch((e) => {
    showFatal("next-i-reporter が起動できません", e);
    app.quit();
  });
});

app.on("window-all-closed", () => {
  cleanupServer();
  app.quit();
});

app.on("before-quit", () => {
  cleanupServer();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    ready().catch((e) => showFatal("起動エラー", e));
  }
});
