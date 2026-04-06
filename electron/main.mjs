import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import dotenv from "dotenv";
import getPort from "get-port";
import { app, BrowserWindow, dialog } from "electron";

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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
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
