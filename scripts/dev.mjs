#!/usr/bin/env node
// 로컬 개발 서버 둘(백엔드 · 프론트)을 한 번에. 3000 · 8000 이 쓰이고 있으면 +1 씩 비어 있는 번호로 띄운다.
//
//   node scripts/dev.mjs            띄우기 — 이미 떠 있으면 주소만
//   node scripts/dev.mjs --open     띄우고 브라우저로 연다
//   node scripts/dev.mjs status     지금 주소 · 살아 있는지
//   node scripts/dev.mjs stop       둘 다 끈다
//
// /autopilot 이 개발을 시작할 때 부른다 — 사람이 자다 깨서(또는 옆에서) 화면이 바뀌는 걸 바로 본다.
// 백엔드는 --reload, 프론트는 Vite HMR 이라 코드가 바뀌면 화면도 바로 바뀐다.
// 서로의 주소를 맞춰서 띄운다: 프론트 → VITE_APP_PUBLIC_BASE_URL, 백엔드 → LOCAL_DOMAIN(CORS). .env 는 건드리지 않는다.
// E2E 는 따로 3100 · 8100 을 쓴다 (frontend/e2e/env.ts) — 겹치지 않는다.

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, ".claude", "autopilot"); // .gitignore 에 있다
const STATE = join(DIR, "dev.json");
const WIN = process.platform === "win32";

// ── 빈 포트 ────────────────────────────────────────────────

/** 누가 그 포트에서 받고 있나 (127.0.0.1 · ::1 둘 다 본다 — Vite 는 localhost 가 ::1 일 수 있다) */
export const portBusy = (port, host = "127.0.0.1") =>
  new Promise((done) => {
    const socket = net.connect({ port, host });
    const finish = (busy) => {
      socket.destroy();
      done(busy);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(500, () => finish(false));
  });

/** 둘 중 하나라도 받고 있으면 */
export const listening = async (port) => (await portBusy(port)) || (await portBusy(port, "::1"));

const canListen = (port) =>
  new Promise((done) => {
    const server = net.createServer();
    server.once("error", () => done(false));
    server.listen(port, "127.0.0.1", () => server.close(() => done(true)));
  });

/** start 부터 +1 씩 비어 있는 첫 번호. avoid 는 건너뛴다 (방금 고른 다른 서버 번호 등) */
export const freePort = async (start, avoid = [], tries = 50) => {
  for (let port = start; port < start + tries; port++) {
    if (avoid.includes(port)) continue;
    if (await listening(port)) continue;
    if (await canListen(port)) return port;
  }
  throw new Error(`${start}–${start + tries - 1} 에 빈 포트가 없다`);
};

// ── 프로세스 ───────────────────────────────────────────────

const alive = (pid) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// Windows 는 cmd 를 거쳐 떼어 띄운다 — 그래야 이 스크립트(와 Claude Code 의 셸 명령)가 끝난 뒤에도 산다
const launch = (command, env, logFile) => {
  const out = openSync(logFile, "a");
  const child = WIN
    ? spawn("cmd.exe", ["/d", "/c", command], { cwd: ROOT, env, detached: true, stdio: ["ignore", out, out], windowsHide: true })
    : spawn("sh", ["-c", command], { cwd: ROOT, env, detached: true, stdio: ["ignore", out, out] });
  child.on("error", () => {});
  child.unref();
  return child.pid;
};

const killTree = (pid) => {
  if (!alive(pid)) return;
  try {
    if (WIN) execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-pid); // detached 라 프로세스 그룹째
  } catch {
    /* 이미 끝났다 */
  }
};

const waitFor = async (url, seconds) => {
  for (let i = 0; i < seconds; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (res.status < 500) return true;
    } catch {
      /* 아직 */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};

const tail = (file, lines = 15) => {
  try {
    return readFileSync(file, "utf8").trimEnd().split("\n").slice(-lines).join("\n");
  } catch {
    return "(로그 없음)";
  }
};

const openBrowser = (url) => {
  try {
    if (WIN) spawn("cmd.exe", ["/d", "/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    else spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  } catch {
    /* 못 열면 주소만 */
  }
};

const loadState = () => {
  try {
    return JSON.parse(readFileSync(STATE, "utf8"));
  } catch {
    return null;
  }
};

const urls = (s) => `화면 http://localhost:${s.web}  ·  관리자 http://localhost:${s.web}/admin  ·  API 문서 http://localhost:${s.api}/docs`;

// ── 명령 ───────────────────────────────────────────────────

export const up = async ({ open = false } = {}) => {
  const prev = loadState();
  if (prev && alive(prev.backendPid) && alive(prev.frontendPid) && (await listening(prev.web)) && (await listening(prev.api))) {
    console.log(`이미 떠 있다 — ${urls(prev)}`);
    if (open) openBrowser(`http://localhost:${prev.web}`);
    return 0;
  }
  if (prev) down({ quiet: true }); // 반쯤 죽은 것 정리

  const api = await freePort(8000);
  const web = await freePort(3000, [api]);
  mkdirSync(DIR, { recursive: true });
  const backendLog = join(DIR, "dev-backend.log");
  const frontendLog = join(DIR, "dev-frontend.log");

  const backendPid = launch(
    `uv --directory backend run uvicorn app.main:app --reload --host 127.0.0.1 --port ${api}`,
    { ...process.env, APP_ENV: "local", LOCAL_DOMAIN: `localhost:${web},127.0.0.1:${web}` },
    backendLog,
  );
  const frontendPid = launch(
    `npm --prefix frontend run dev -- --port ${web} --strictPort`,
    { ...process.env, VITE_APP_PUBLIC_BASE_URL: `http://localhost:${api}` },
    frontendLog,
  );
  const state = { web, api, backendPid, frontendPid, startedAt: new Date().toISOString() };
  writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n", "utf8");

  const [backendOk, frontendOk] = await Promise.all([
    waitFor(`http://127.0.0.1:${api}/api/health`, 90),
    waitFor(`http://localhost:${web}/`, 90),
  ]);
  if (!backendOk || !frontendOk) {
    if (!backendOk) console.log(`백엔드가 ${api} 에서 뜨지 않았다 — 마지막 로그:\n${tail(backendLog)}`);
    if (!frontendOk) console.log(`프론트가 ${web} 에서 뜨지 않았다 — 마지막 로그:\n${tail(frontendLog)}`);
    console.log(`로그: ${backendLog} · ${frontendLog}  ·  끄기: node scripts/dev.mjs stop`);
    return 1;
  }
  const moved = web !== 3000 || api !== 8000;
  console.log(
    `${urls(state)}\n` +
      (moved ? `(3000 · 8000 이 쓰이고 있어 ${web} · ${api} 로 띄웠다 — 소셜 로그인은 콘솔에 등록한 3000 주소에서만 된다)\n` : "") +
      `끄기: node scripts/dev.mjs stop`,
  );
  if (open) openBrowser(`http://localhost:${web}`);
  return 0;
};

export const down = ({ quiet = false } = {}) => {
  const s = loadState();
  if (!s) {
    if (!quiet) console.log("떠 있는 개발 서버가 없다.");
    return 0;
  }
  killTree(s.backendPid);
  killTree(s.frontendPid);
  if (existsSync(STATE)) rmSync(STATE);
  if (!quiet) console.log(`껐다 — ${s.web} · ${s.api}`);
  return 0;
};

export const status = async () => {
  const s = loadState();
  if (!s) {
    console.log("떠 있는 개발 서버가 없다 — node scripts/dev.mjs");
    return 0;
  }
  const b = (await listening(s.api)) ? "켜짐" : "꺼짐";
  const f = (await listening(s.web)) ? "켜짐" : "꺼짐";
  console.log(`백엔드 ${s.api} ${b} · 프론트 ${s.web} ${f}\n${urls(s)}`);
  return 0;
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const [command] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const open = process.argv.includes("--open");
  const run = { stop: () => down(), status: () => status() }[command] ?? (() => up({ open }));
  process.exitCode = await run();
}
