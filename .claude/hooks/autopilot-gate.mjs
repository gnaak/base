#!/usr/bin/env node
// 무인 실행(autopilot) 게이트. `/autopilot` 이 켜 둔 동안만 동작하고, 꺼져 있으면 아무것도 하지 않는다.
//
//   node .claude/hooks/autopilot-gate.mjs start      /autopilot 이 부른다 — 상태 파일을 만든다
//   node .claude/hooks/autopilot-gate.mjs status     지금 phase · 턴 · 상한
//   node .claude/hooks/autopilot-gate.mjs off        끄기 (/autopilot stop)
//   node .claude/hooks/autopilot-gate.mjs stop-hook  Stop 훅 — 남은 phase 가 있으면 멈추지 못하게 하고 다음 지시를 준다
//   node .claude/hooks/autopilot-gate.mjs pre-tool   PreToolUse 훅 — 무인 중 push · merge · 배포 명령을 막는다
//   node .claude/hooks/autopilot-gate.mjs stop-failure  StopFailure 훅 — 사용 한도 · API 오류로 멈춘 시각을 남긴다
//   node .claude/hooks/autopilot-gate.mjs awake on|off  잠자기 막기 — /start · /plan 이 켜고 autopilot 이 끝나면 꺼진다
//   node .claude/hooks/autopilot-gate.mjs auto-continue 사용 한도가 풀리면 알아서 이어 가게 (사용자 설정 한 줄)
//
// 원형은 gnaak/prd 의 autopilot-gate.ps1. 거기서 배운 두 가지를 그대로 가져왔다:
// - 완료 판정은 표시가 아니라 근거로 한다 — ✅ 라고 적었어도 그 phase 의 커밋과 검증 줄이 없으면 안 넘어간다
// - 같은 단계에서 진전 없이 멈춘 횟수에 상한을 둔다 — 넘으면 그 phase 를 ❌ 로 기록하고 다음으로 (무한 루프 방지)
//
// 의존성 없이 Node 만 쓴다 — 프론트 때문에 어느 환경에나 있고, Windows · Linux 에서 같은 파일이 돈다.

import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.env.AUTOPILOT_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STATE_DIR = join(ROOT, ".claude", "autopilot");
const STATE_FILE = join(STATE_DIR, "state.json");

const capFromEnv = (name, fallback) => {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// 상한. 환경변수는 테스트와 조정용.
export const CAPS = {
  stall: capFromEnv("AUTOPILOT_STALL_CAP", 3), //        아무것도 안 바뀐 채 연속으로 멈춘 횟수
  phaseTurns: capFromEnv("AUTOPILOT_PHASE_TURN_CAP", 40), // 한 phase 에서 멈춘 횟수 (바뀌고는 있는데 안 끝남)
  finishTurns: capFromEnv("AUTOPILOT_FINISH_TURN_CAP", 10),
  totalTurns: capFromEnv("AUTOPILOT_TOTAL_TURN_CAP", 400),
};

// ── 파일 · git ─────────────────────────────────────────────

const read = (rel) => {
  try {
    return readFileSync(join(ROOT, rel), "utf8");
  } catch {
    return null;
  }
};

const write = (rel, text) => writeFileSync(join(ROOT, rel), text, "utf8");

const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};

// 상태 파일은 .gitignore 에 있지만, 혹시 빠져 있어도 지문·"깨끗한가" 판정에 끼지 않게 한 번 더 거른다
const STATE_PATH_IN_GIT = ".claude/autopilot/";
const porcelain = () =>
  git("status", "--porcelain=v1", "-uall")
    .split("\n")
    .filter((line) => line && !line.includes(STATE_PATH_IN_GIT));

export const loadState = () => {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null;
  }
};

const saveState = (state) => {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
};

// ── PROJECT.md · PROGRESS.md 읽기 ──────────────────────────

// "## phase 3: 주문" — phase 0 은 사람이 할 일(준비)이라 무인 실행이 건너뛴다
export const parsePhases = (projectMd) => {
  const phases = [];
  for (const m of (projectMd ?? "").matchAll(/^##\s*phase\s+(\d+)\s*[:：]\s*(.+?)\s*$/gim)) {
    const n = Number(m[1]);
    if (n >= 1 && !phases.some((p) => p.n === n)) phases.push({ n, name: m[2] });
  }
  return phases.sort((a, b) => a.n - b.n);
};

const STATUS_MARKS = ["⬜", "🔄", "✅", "❌"];

// "## phase 3: 주문" 또는 옛 양식 "## 3 단계: 주문" 아래의 "- 상태: ✅ 완료" · "- 검증: …"
// 양식의 안내 줄("⬜ 대기 / 🔄 진행중 / …")이 그대로면 맨 앞 표시(⬜)로 읽힌다
export const parseProgress = (progressMd) => {
  const entries = new Map();
  for (const section of (progressMd ?? "").split(/^(?=##\s)/m)) {
    const head = section.match(/^##\s*(?:phase\s+(\d+)|(\d+)\s*단계)/i);
    if (!head) continue;
    const n = Number(head[1] ?? head[2]);
    const statusLine = section.match(/^-\s*상태\s*:\s*(.*)$/m)?.[1] ?? "";
    let status = "⬜";
    let first = Infinity;
    for (const mark of STATUS_MARKS) {
      const i = statusLine.indexOf(mark);
      if (i !== -1 && i < first) [first, status] = [i, mark];
    }
    const verify = section.match(/^-\s*검증\s*:[ \t]*(\S.*)$/m)?.[1] ?? "";
    entries.set(n, { status, verify });
  }
  return entries;
};

const phaseCommitted = (n, since) => {
  const range = since ? [`${since}..HEAD`] : [];
  return git("log", "--format=%s", ...range)
    .split("\n")
    .some((subject) => new RegExp(`\\bphase\\s*${n}\\b`, "i").test(subject));
};

// ── 결과 기록 ───────────────────────────────────────────────

const now = () => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// 상한에 걸린 phase 를 ❌ 로 적는다 — 메인이 따르지 않아도 다음 phase 로 넘어가게 게이트가 직접 쓴다
const markFailed = (phase, why) => {
  const statusText = `- 상태: ❌ 실패 — autopilot: ${why} (${now()})`;
  const progress = read("PROGRESS.md") ?? "# PROGRESS\n";
  const sections = progress.split(/^(?=##\s)/m);
  let found = false;
  const updated = sections.map((section) => {
    const head = section.match(/^##\s*(?:phase\s+(\d+)|(\d+)\s*단계)/i);
    if (!head || Number(head[1] ?? head[2]) !== phase.n) return section;
    found = true;
    return /^-\s*상태\s*:.*$/m.test(section)
      ? section.replace(/^-\s*상태\s*:.*$/m, statusText)
      : section.replace(/\n*$/, `\n\n${statusText}\n\n`);
  });
  let next = updated.join("");
  if (!found) next = next.replace(/\n*$/, `\n\n## phase ${phase.n}: ${phase.name}\n\n${statusText}\n`);
  write("PROGRESS.md", next);

  const line = `- [${now()}] phase ${phase.n} 「${phase.name}」 — autopilot 이 ❌ 로 넘김: ${why}. 그때의 변경은 \`git stash list\` 의 "autopilot phase ${phase.n}"`;
  const decisions = read("DECISIONS.md") ?? "# 결정 필요\n";
  const heading = /^##\s*⛔.*$/m;
  if (heading.test(decisions)) {
    // ⛔ 절의 끝(다음 ## 앞)에 붙인다
    const start = decisions.search(heading);
    const rest = decisions.slice(start + 1);
    const nextHeading = rest.search(/^##\s/m);
    const end = nextHeading === -1 ? decisions.length : start + 1 + nextHeading;
    const before = decisions.slice(0, end).replace(/\n*$/, "\n");
    write("DECISIONS.md", `${before}${line}\n\n${decisions.slice(end)}`.replace(/\n*$/, "\n"));
  } else {
    write("DECISIONS.md", `${decisions.replace(/\n*$/, "\n")}\n## ⛔ 막힌 곳\n\n${line}\n`);
  }
};

// 마무리 요약 — DECISIONS.md 에 이번 run 의 절이 있고 "최종 검증" · "페이지" 줄이 채워져 있어야 끝난 것
const finishMissing = (state) => {
  const missing = [];
  if (porcelain().length) missing.push("커밋 안 된 변경");
  const decisions = read("DECISIONS.md") ?? "";
  const sectionStart = decisions.search(new RegExp(`^##.*무인 실행 결과.*run\\s+${state.runId}`, "m"));
  if (sectionStart === -1) {
    missing.push(`DECISIONS.md 의 "## 🌙 무인 실행 결과 — run ${state.runId}" 절`);
  } else {
    const rest = decisions.slice(sectionStart + 1);
    const nextHeading = rest.search(/^##\s/m);
    const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
    if (!/^-\s*최종 검증\s*:[ \t]*\S/m.test(section)) missing.push("그 절의 `- 최종 검증:` 줄 (/verify full 결과)");
    if (!/^-\s*페이지\s*:[ \t]*\S/m.test(section)) missing.push("그 절의 `- 페이지:` 줄 (휴대폰 페이지 URL, 못 만들었으면 사유)");
  }
  return missing;
};

// ── 판정 ───────────────────────────────────────────────────

const RULES =
  "묻지 말 것 — 결정이 필요하면 더 안전한 기본값으로 가고 DECISIONS.md 에 적는다. push · merge · 배포는 하지 않는다.";

// 지금 해야 할 일 하나를 고른다: 근거 없는 ✅ → 진행할 phase → 마무리
export const decide = (state) => {
  const phases = parsePhases(read("PROJECT.md"));
  const progress = parseProgress(read("PROGRESS.md"));
  // 게이트가 ❌ 로 넘긴 phase 는 PROGRESS.md 가 되돌려져도(stash 등) ❌ 로 본다 — 같은 phase 로 돌아가 맴돌지 않게
  const statusOf = (n) => (state.failed?.includes(n) ? "❌" : (progress.get(n)?.status ?? "⬜"));
  const last = phases.at(-1)?.n ?? 0;

  for (const phase of phases) {
    if (statusOf(phase.n) !== "✅" || state.preDone?.includes(phase.n)) continue;
    const missing = [];
    if (!phaseCommitted(phase.n, state.startHead)) missing.push(`커밋 (제목에 "phase ${phase.n}")`);
    if (!progress.get(phase.n)?.verify) missing.push("PROGRESS.md 의 `- 검증:` 줄");
    if (missing.length) {
      return {
        kind: "evidence",
        stage: `evidence-${phase.n}`,
        phase,
        text:
          `phase ${phase.n} 「${phase.name}」 이 ✅ 인데 근거가 없다: ${missing.join(", ")}. ` +
          `/verify phase ${phase.n} 결과를 PROGRESS.md 의 \`- 검증:\` 줄에 적고 \`feat: phase ${phase.n} — ${phase.name}\` 으로 커밋하라. ` +
          `실제로 끝나지 않았으면 🔄 로 되돌리고 이어서 한다. ${RULES}`,
      };
    }
  }

  const current = phases.find((p) => !["✅", "❌"].includes(statusOf(p.n)));
  if (current) {
    const started = statusOf(current.n) === "🔄";
    return {
      kind: "phase",
      stage: `phase-${current.n}`,
      phase: current,
      text:
        `phase ${current.n}/${last} 「${current.name}」 을 ${started ? "이어서 한다" : "시작한다"}. ` +
        "`.claude/commands/autopilot.md` 의 \"phase 하나\" 순서대로: PROGRESS 🔄 → 구현 → phase E2E → /test → " +
        `/verify phase ${current.n} → ❌ 고치기 → PROGRESS ✅ + \`- 검증:\` 줄 → 커밋 \`feat: phase ${current.n} — ${current.name}\`. ${RULES}`,
    };
  }

  const done = phases.filter((p) => statusOf(p.n) === "✅").length;
  const failed = phases.length - done;
  const missing = finishMissing(state);
  if (!missing.length) return { kind: "done" };
  return {
    kind: "finish",
    stage: "finish",
    text:
      `phase 가 전부 끝났다 (✅ ${done} · ❌ ${failed}). \`.claude/commands/autopilot.md\` 의 "마무리" 순서대로 하라. ` +
      `아직 없는 것: ${missing.join(", ")}. ${RULES}`,
  };
};

// 진전 판정용 지문 — 커밋 · 작업 트리 내용 · 새 파일이 하나라도 바뀌면 다른 값
const fingerprint = () => {
  const lines = porcelain();
  const untracked = lines
    .filter((l) => l.startsWith("??"))
    .map((l) => {
      const rel = l.slice(3).replace(/^"|"$/g, "");
      try {
        const s = statSync(join(ROOT, rel));
        return `${rel}:${s.size}:${s.mtimeMs}`;
      } catch {
        return rel;
      }
    });
  return createHash("sha1")
    .update([git("rev-parse", "HEAD"), lines.join("\n"), git("diff", "HEAD"), untracked.join("\n")].join("\0"))
    .digest("hex");
};

const block = (reason) => {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
};

// ── Stop 훅 ────────────────────────────────────────────────

export const stopHook = () => {
  heartbeat();
  const state = loadState();
  if (!state?.active) return; // 꺼져 있으면 평소처럼 멈춘다

  const finishRun = (message) => {
    saveState({ ...state, active: false, finishedAt: now() });
    awakeOff();
    block(message);
  };

  state.totalTurns = (state.totalTurns ?? 0) + 1;
  if (state.totalTurns > CAPS.totalTurns) {
    return finishRun(
      `[autopilot 중단] 총 ${CAPS.totalTurns}턴을 넘어 자동으로 껐다. PROGRESS.md · DECISIONS.md 에 지금 상태를 적고 사람에게 보고한 뒤 끝내라.`,
    );
  }
  if (read("PROJECT.md") === null || !parsePhases(read("PROJECT.md")).length) {
    return finishRun(
      "[autopilot 중단] PROJECT.md 가 없거나 phase(## phase N: 이름)가 없다. /plan 으로 먼저 만들어야 한다고 보고하고 끝내라.",
    );
  }

  let decision = decide(state);
  if (decision.kind === "done") {
    saveState({ ...state, active: false, finishedAt: now(), stage: "done" });
    awakeOff();
    return; // 다 끝났다 — 멈추게 둔다
  }

  const fp = fingerprint();
  if (decision.stage === state.stage) {
    state.stageTurns = (state.stageTurns ?? 0) + 1;
    state.stalls = fp === state.fp ? (state.stalls ?? 0) + 1 : 0;
  } else {
    state.stage = decision.stage;
    state.stageTurns = 1;
    state.stalls = 0;
  }
  state.fp = fp;

  const turnCap = decision.kind === "finish" ? CAPS.finishTurns : CAPS.phaseTurns;
  const stalled = state.stalls >= CAPS.stall;
  const exhausted = state.stageTurns > turnCap;

  if (stalled || exhausted) {
    const why = stalled ? `진전 없이 ${CAPS.stall}번 연속 멈춤` : `${turnCap}턴 안에 끝나지 않음`;
    if (decision.kind === "finish") {
      return finishRun(
        `[autopilot 끝 — 마무리 미완] ${why}. 남은 마무리를 할 수 있는 만큼 하고, 못 한 것을 사람에게 보고한 뒤 끝내라.`,
      );
    }
    markFailed(decision.phase, why);
    const failedPhase = decision.phase;
    state.failed = [...new Set([...(state.failed ?? []), failedPhase.n])];
    decision = decide(state);
    if (decision.kind === "done") {
      saveState({ ...state, active: false, finishedAt: now(), stage: "done" });
      awakeOff();
      return;
    }
    state.stage = decision.stage;
    state.stageTurns = 1;
    state.stalls = 0;
    state.fp = fingerprint();
    saveState(state);
    return block(
      `[autopilot] phase ${failedPhase.n} 「${failedPhase.name}」 을 ❌ 로 넘겼다 — ${why}. PROGRESS.md 와 DECISIONS.md ⛔ 에 적어 두었다. ` +
        `그 phase 의 변경은 \`git stash push -u -m "autopilot phase ${failedPhase.n}" -- . ":(exclude)PROGRESS.md" ":(exclude)DECISIONS.md"\` 로 치우고 ` +
        `(지우지 말 것 — 사람이 본다) PROGRESS.md · DECISIONS.md 를 \`docs: phase ${failedPhase.n} ❌ — ${why}\` 로 커밋해서 ` +
        `다음 phase 가 마지막 커밋 위에서 시작하게 하라. 그다음: ${decision.text}`,
    );
  }

  saveState(state);
  const label =
    decision.kind === "finish"
      ? `마무리 ${state.stageTurns}/${CAPS.finishTurns}`
      : `${state.stage} ${state.stageTurns}/${CAPS.phaseTurns}턴`;
  block(`[autopilot run ${state.runId} · ${label} · 진전 없음 ${state.stalls}/${CAPS.stall}] 아직 끝나지 않았다. ${decision.text}`);
};

// ── PreToolUse 훅 — 무인으로 넘지 않는 선 ──────────────────

// 명령의 시작 위치(맨 앞 · ; & | ( 뒤 · 줄 시작)에 올 때만 본다 — 커밋 메시지 안의 "git push" 같은 글자는 통과
const AT_COMMAND = String.raw`(?:^|[;&|(\n]\s*)`;
export const FORBIDDEN = [
  [new RegExp(`${AT_COMMAND}git\\s+push\\b`), "git push"],
  [new RegExp(`${AT_COMMAND}git\\s+merge\\b`), "git merge"],
  [new RegExp(`${AT_COMMAND}git\\s+(?:checkout|switch)\\s+(?:main|master)\\b`), "main 으로 전환"],
  [new RegExp(`${AT_COMMAND}gh\\s+pr\\s+(?:create|merge)\\b`), "PR 생성 · 머지"],
  [/\bterraform(?:\.exe)?\b[^\n;&|]*\b(?:apply|destroy|import)\b/, "terraform apply · destroy"],
  [/\btf\.ps1\b[^\n;&|]*\b(?:apply|destroy|import)\b/, "terraform apply · destroy"],
  [/\baws\s+(?:ssm\s+send-command|s3\s+(?:cp|sync|rm|mv))\b/, "AWS 배포 명령"],
  [/\b(?:deploy|rollback)\.sh\b/, "배포 스크립트"],
];

export const forbiddenReason = (command) => FORBIDDEN.find(([re]) => re.test(command ?? ""))?.[1] ?? null;

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

/** 무인 실행을 확인 창에서 멈추게 하는 호출이면 이유를, 아니면 null. 확인 창 대신 거부해서 Claude 가 다른 길로 가게 한다. */
export const unattendedStopReason = (input, root = ROOT) => {
  const tool = input?.tool_name;
  const args = input?.tool_input ?? {};
  // .claude/ 아래 편집은 편집 자동 승인에서도 파일마다 묻는다 (test2 에서 확인) — 밤새 거기서 멈춘다
  if (EDIT_TOOLS.has(tool) && args.file_path) {
    const rel = relative(resolve(root), resolve(root, args.file_path)).replace(/\\/g, "/");
    if (rel === ".claude" || rel.startsWith(".claude/")) {
      return (
        `[autopilot] 무인 실행 중에는 .claude/ 아래(${rel})를 고치지 않는다 — 확인 창이 떠서 멈춘다. ` +
        "설명 문서에 남은 언급이면 그대로 두고 DECISIONS.md 🔍 에 \"사람이 있을 때 정리\" 한 줄을 적고 계속하라."
      );
    }
  }
  // 백그라운드 에이전트는 완료 알림이 턴을 바꾸고, 기다리며 턴을 끝내면 Stop 훅이 "진전 없음" 을 센다
  if ((tool === "Agent" || tool === "Task") && args.run_in_background === true) {
    return (
      "[autopilot] 무인 실행 중에는 하위 에이전트를 run_in_background: false 로 부른다 — 병렬이 필요하면 한 메시지에 여러 개. " +
      "같은 호출을 run_in_background: false 로 다시 하라."
    );
  }
  return null;
};

const deny = (reason) =>
  // 도구 호출을 막고 이유를 Claude 에게 보여 준다 (exit 2 + stderr 도 되지만 문서가 권하는 건 이 JSON)
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
    }),
  );

export const preToolHook = (input) => {
  heartbeat();
  if (!loadState()?.active) return;
  const stop = unattendedStopReason(input);
  if (stop) return deny(stop);
  const hit = forbiddenReason(input?.tool_input?.command);
  if (!hit) return;
  deny(
    `[autopilot] 무인 실행 중에는 ${hit} 을(를) 하지 않는다 — 브랜치 · 테스트 키 · 로컬 DB 까지만. ` +
      "사람이 해야 하는 일이면 DECISIONS.md 의 🧑 사람이 할 일에 적고 계속하라.",
  );
};

// ── 잠자기 막기 — /start · /plan · /autopilot 동안 ──────────
//
// 자는 동안 기획 → 개발이 도는데 PC 가 절전에 들어가면 거기서 멈춘다. `awake on` 이 작은 프로세스를 따로 띄워
// "잠자지 마" 를 걸고, 그 프로세스는 1분마다 awake.json 을 보다가 아래 중 하나면 스스로 끝난다:
//   - active 가 false (autopilot 끝 · stop · `/plan` 이 "기획만" 으로 끝남 → `awake off`)
//   - 훅이 마지막으로 다녀간 지(seen) 6시간 — 세션이 죽었거나 사람이 창을 닫았다. 5시간 사용 한도를 기다리는 동안은
//     깨어 있어야 "Continue automatically at usage limit" 가 이어 가므로 5시간보다 길게 잡았다
//   - 띄운 지 48시간
// 관리자 권한이 필요 없다. 화면은 꺼질 수 있다 (시스템만 깨어 있게). ⚠️ 노트북 덮개를 닫으면 덮개 설정이 이긴다.

const AWAKE_FILE = join(STATE_DIR, "awake.json");
const AWAKE_IDLE_HOURS = 6;
const AWAKE_MAX_HOURS = 48;

const epoch = () => Math.floor(Date.now() / 1000);

export const loadAwake = () => {
  try {
    return JSON.parse(readFileSync(AWAKE_FILE, "utf8"));
  } catch {
    return null;
  }
};

const saveAwake = (awake) => {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(AWAKE_FILE, JSON.stringify(awake) + "\n", "utf8");
};

// Windows — SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED). PowerShell 5.1 의 16진 리터럴 0x8… 은
// 음수 Int32 라 uint 로 못 바뀐다 — 10진수로 쓴다 (2147483648 = ES_CONTINUOUS, +1 = ES_SYSTEM_REQUIRED)
const windowsScript = (file) => `
$k = Add-Type -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);' -Name K -Namespace AutopilotKeepAwake -PassThru
$end = (Get-Date).AddHours(${AWAKE_MAX_HOURS})
while ((Get-Date) -lt $end) {
  try { $s = Get-Content -Raw -LiteralPath '${file.replace(/'/g, "''")}' | ConvertFrom-Json } catch { break }
  if (-not $s.active) { break }
  if ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() - [int64]$s.seen -gt ${AWAKE_IDLE_HOURS * 3600}) { break }
  [void]$k::SetThreadExecutionState([uint32]2147483649)
  Start-Sleep -Seconds 60
}
[void]$k::SetThreadExecutionState([uint32]2147483648)
`;

const posixLoop = (file) => {
  const f = `'${file.replace(/'/g, "'\''")}'`;
  return (
    `end=$(( $(date +%s) + ${AWAKE_MAX_HOURS * 3600} )); ` +
    `while [ "$(date +%s)" -lt "$end" ]; do ` +
    `grep -q '"active":true' ${f} 2>/dev/null || break; ` +
    `seen=$(sed -n 's/.*"seen":\\([0-9]*\\).*/\\1/p' ${f}); ` +
    `[ $(( $(date +%s) - \${seen:-0} )) -gt ${AWAKE_IDLE_HOURS * 3600} ] && break; ` +
    `sleep 60; done`
  );
};

/** 플랫폼별 [명령, 인자]. 막을 방법이 없으면 null. 테스트가 명령 모양을 본다. */
export const keepAwakeCommand = (platform = process.platform, file = AWAKE_FILE) => {
  if (platform === "win32") {
    const encoded = Buffer.from(windowsScript(file), "utf16le").toString("base64");
    // cmd 를 거친다 — 떼어 띄운(detached) powershell 은 콘솔이 없어 바로 종료(코드 0)된다. cmd 는 살아 있고,
    // 그 아래 powershell 도 Claude Code 의 셸 명령이 끝난 뒤까지 산다 (둘 다 직접 확인)
    return [
      "cmd.exe",
      ["/d", "/c", "powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", encoded],
    ];
  }
  if (platform === "darwin") return ["caffeinate", ["-i", "sh", "-c", posixLoop(file)]];
  if (platform === "linux") {
    return ["systemd-inhibit", ["--what=sleep:idle", "--who=autopilot", "--why=무인 실행 중", "sh", "-c", posixLoop(file)]];
  }
  return null;
};

const alive = (pid) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** 잠자기 막기를 켠다. 이미 떠 있으면 표시만 새로. 못 띄우면 pid null — 그래도 일은 계속한다 (절전만 사람이 끈다). */
export const awakeOn = (why = "") => {
  const prev = loadAwake();
  const awake = { active: true, since: prev?.active ? prev.since : epoch(), seen: epoch(), why, pid: prev?.pid ?? null };
  saveAwake(awake); // 프로세스보다 먼저 — 첫 확인에서 active 를 봐야 한다
  if (process.env.AUTOPILOT_NO_KEEP_AWAKE || alive(awake.pid)) return awake;
  const cmd = keepAwakeCommand();
  if (!cmd) return awake;
  try {
    const child = spawn(cmd[0], cmd[1], { cwd: ROOT, detached: true, stdio: "ignore", windowsHide: true });
    child.on("error", () => {}); // 명령이 없으면(caffeinate · systemd-inhibit) 조용히 넘어간다
    child.unref();
    awake.pid = child.pid ?? null;
    saveAwake(awake);
  } catch {
    /* 못 띄웠다 */
  }
  return awake;
};

export const awakeOff = () => {
  const awake = loadAwake();
  if (!awake) return;
  saveAwake({ ...awake, active: false });
  if (alive(awake.pid)) {
    // 1분 안에 스스로 끝나지만 바로 놓아 준다. Windows 는 cmd 아래 powershell 까지 트리째
    try {
      if (process.platform === "win32") {
        execFileSync("taskkill", ["/PID", String(awake.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        process.kill(awake.pid);
      }
    } catch {
      /* 이미 끝났다 */
    }
  }
};

/** 훅이 돌 때마다 — "아직 일하는 중". 켜져 있을 때만 쓴다 (안 켰으면 아무것도 안 한다). */
const heartbeat = () => {
  const awake = loadAwake();
  if (awake?.active) saveAwake({ ...awake, seen: epoch() });
};

// ── 사용 한도에서 자동으로 이어 가기 ───────────────────────
// Claude Code 설정 `autoContinueAtUsageLimit` (사용자 설정 ~/.claude/settings.json) — 5시간 한도가 풀리면 알아서 이어 간다.
// 프로젝트 설정이 아니라 사용자 설정이라 /start 가 이걸로 켠다. 다른 키는 건드리지 않고, 파일이 깨져 있으면 손대지 않는다.

export const autoContinueOn = (file = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "settings.json")) => {
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    if (err?.code !== "ENOENT") return `${file} 를 읽지 못해 그대로 둔다 — /config 에서 "Continue automatically at usage limit" 를 켠다`;
  }
  if (settings.autoContinueAtUsageLimit === true) return "이미 켜져 있다 (autoContinueAtUsageLimit)";
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ ...settings, autoContinueAtUsageLimit: true }, null, 2) + "\n", "utf8");
  return `켰다 — ${file} 의 autoContinueAtUsageLimit`;
};

// ── StopFailure 훅 — 사용 한도 · API 오류로 턴이 끝났을 때 ─────
// 막을 수는 없다(이미 실패했다). 언제 무엇으로 멈췄는지 상태에 남겨 status · 아침 요약에 보이게 한다.
// 다시 이어 가는 건 Claude Code 의 "Continue automatically at usage limit" 설정이 한다 — 그동안 깨어 있게 heartbeat.

export const stopFailureHook = (input) => {
  heartbeat();
  const state = loadState();
  if (!state?.active) return;
  const failures = [...(state.failures ?? []), { at: now(), type: input?.error_type ?? "unknown" }].slice(-20);
  saveState({ ...state, failures });
};

// ── start · status · off ───────────────────────────────────

const runId = () => now().replace(/[-:]/g, "").replace(" ", "-");

const phaseTable = () => {
  const phases = parsePhases(read("PROJECT.md"));
  const progress = parseProgress(read("PROGRESS.md"));
  return phases.map((p) => `  ${progress.get(p.n)?.status ?? "⬜"} phase ${p.n}: ${p.name}`).join("\n");
};

export const start = () => {
  if (!parsePhases(read("PROJECT.md")).length) {
    console.log("PROJECT.md 가 없거나 phase(## phase N: 이름)가 없다 — /plan 을 먼저 돌린다.");
    return 1;
  }
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (["main", "master"].includes(branch)) {
    console.log(`지금 브랜치가 ${branch} 다. 무인 실행은 브랜치에서만 — \`git switch -c auto/${runId()}\` 하고 다시 시작한다.`);
    return 1;
  }
  const dirty = porcelain();
  if (dirty.length) {
    console.log(
      `커밋 안 된 변경이 ${dirty.length}개 있다 — 커밋하거나 치우고 다시 시작한다 (진전 판정과 phase 근거가 커밋을 기준으로 한다).\n` +
        dirty.slice(0, 10).join("\n"),
    );
    return 1;
  }
  const previous = loadState();
  awakeOn("autopilot");
  if (previous?.active) {
    saveState({ ...previous, stage: null, stageTurns: 0, stalls: 0, fp: null });
    console.log(`이미 실행 중인 run ${previous.runId} 를 이어서 한다 (턴 카운터만 초기화).\n${phaseTable()}`);
    return 0;
  }
  const progress = parseProgress(read("PROGRESS.md"));
  const state = {
    active: true,
    runId: runId(),
    startedAt: now(),
    branch,
    startHead: git("rev-parse", "HEAD"),
    // 시작 전에 이미 ✅ 인 phase 는 근거(커밋 제목 · 검증 줄)를 따지지 않는다
    preDone: [...progress].filter(([, e]) => e.status === "✅").map(([n]) => n),
    stage: null,
    stageTurns: 0,
    stalls: 0,
    totalTurns: 0,
    fp: null,
  };
  saveState(state);
  console.log(
    `autopilot 켬 — run ${state.runId} · 브랜치 ${branch}\n${phaseTable()}\n` +
      `상한: 진전 없이 ${CAPS.stall}번 · phase 당 ${CAPS.phaseTurns}턴 · 마무리 ${CAPS.finishTurns}턴 · 전체 ${CAPS.totalTurns}턴`,
  );
  return 0;
};

export const status = () => {
  const state = loadState();
  if (!state) {
    console.log("autopilot 을 돌린 적이 없다.");
    return 0;
  }
  console.log(
    `${state.active ? "켜짐" : "꺼짐"} — run ${state.runId} · 브랜치 ${state.branch} · 시작 ${state.startedAt}` +
      (state.finishedAt ? ` · 끝 ${state.finishedAt}` : "") +
      `\n단계 ${state.stage ?? "-"} · 이 단계 ${state.stageTurns ?? 0}턴 · 진전 없음 ${state.stalls ?? 0}/${CAPS.stall} · 전체 ${state.totalTurns ?? 0}턴\n${phaseTable()}` +
      `\n잠자기 막기: ${loadAwake()?.active ? "켜짐" : "꺼짐"}` +
      (state.failures?.length
        ? `\n멈춘 기록(사용 한도 · API 오류): ${state.failures.map((f) => `${f.at} ${f.type}`).join(" · ")}`
        : ""),
  );
  return 0;
};

export const off = () => {
  const state = loadState();
  if (state?.active) saveState({ ...state, active: false, finishedAt: now(), stage: "off" });
  awakeOff();
  console.log(state?.active ? `autopilot 끔 — run ${state.runId}` : "이미 꺼져 있다.");
  return 0;
};

// ── 진입점 ─────────────────────────────────────────────────

const readStdin = () => {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const command = process.argv[2];
  let code = 0;
  try {
    if (command === "stop-hook") {
      readStdin();
      stopHook();
    } else if (command === "pre-tool") preToolHook(readStdin());
    else if (command === "stop-failure") stopFailureHook(readStdin());
    else if (command === "auto-continue") console.log(autoContinueOn());
    else if (command === "awake") {
      if (process.argv[3] === "off") awakeOff();
      else console.log(`잠자기 막기 켬 — pid ${awakeOn(process.argv.slice(4).join(" ")).pid ?? "-"}`);
    }
    else if (command === "start") code = start();
    else if (command === "status") code = status();
    else if (command === "off") code = off();
    else {
      console.log("사용법: autopilot-gate.mjs start | status | off | awake [on|off] | auto-continue | stop-hook | pre-tool | stop-failure");
      code = 1;
    }
  } catch (err) {
    // 게이트가 터져서 세션이 멈추지 못하거나 도구가 막히면 안 된다 — 훅이면 그냥 통과시킨다
    process.stderr.write(`[autopilot-gate] ${err?.stack ?? err}\n`);
    code = ["stop-hook", "pre-tool", "stop-failure", "awake"].includes(command) ? 0 : 1;
  }
  process.exitCode = code;
}
