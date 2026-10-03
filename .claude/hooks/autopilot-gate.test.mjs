// autopilot-gate.mjs 테스트 — `node --test .claude/hooks/` (CI frontend 잡에서도 돈다)
//
// 임시 git 저장소에 PROJECT.md · PROGRESS.md · DECISIONS.md 를 만들고, 진짜 훅처럼 별도 프로세스로 불러서
// stdout(JSON) · 상태 파일 · 게이트가 고친 파일을 본다. AUTOPILOT_ROOT 로 저장소 위치를 바꾼다.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { forbiddenReason, parsePhases, parseProgress } from "./autopilot-gate.mjs";

const GATE = join(dirname(fileURLToPath(import.meta.url)), "autopilot-gate.mjs");

const PROJECT = `# PROJECT

## phase 0: 준비

사람이 할 일

## phase 1: 회원

**완료 기준**: - [ ] F1-1 ...

## phase 2: 주문

**완료 기준**: - [ ] F2-1 ...
`;

const progress = ({ p1 = "⬜ 대기", v1 = "", p2 = "⬜ 대기", v2 = "" } = {}) => `# PROGRESS

## phase 0: 준비

- 상태: ⬜ 대기

## phase 1: 회원

- 상태: ${p1}
- 검증: ${v1}

## phase 2: 주문

- 상태: ${p2}
- 검증: ${v2}
`;

const DECISIONS = `# 결정 필요

## 🔴 돈 · 법 · 범위

## ⛔ 막힌 곳

## 🔍 검토 필요
`;

const makeRepo = (t, { branch = "auto/test", env = {} } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "autopilot-"));
  t.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3 }));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
  git("init", "-q", "-b", branch);
  git("config", "user.email", "autopilot@example.com");
  git("config", "user.name", "autopilot");
  git("config", "commit.gpgsign", "false");

  const repo = {
    dir,
    git,
    write: (rel, text) => writeFileSync(join(dir, rel), text, "utf8"),
    read: (rel) => readFileSync(join(dir, rel), "utf8"),
    remove: (rel) => unlinkSync(join(dir, rel)),
    commit: (message) => {
      git("add", "-A");
      git("commit", "-q", "--allow-empty", "-m", message);
    },
    state: () => {
      try {
        return JSON.parse(readFileSync(join(dir, ".claude", "autopilot", "state.json"), "utf8"));
      } catch {
        return null;
      }
    },
    run: (command, input = {}) => {
      const r = spawnSync(process.execPath, [GATE, command], {
        input: JSON.stringify(input),
        encoding: "utf8",
        env: {
          ...process.env,
          AUTOPILOT_ROOT: dir,
          AUTOPILOT_STALL_CAP: "3",
          AUTOPILOT_PHASE_TURN_CAP: "6",
          AUTOPILOT_FINISH_TURN_CAP: "4",
          ...env,
        },
      });
      let json = null;
      try {
        json = r.stdout ? JSON.parse(r.stdout) : null;
      } catch {
        // start · status 는 사람이 읽는 글이다
      }
      return { code: r.status, stdout: r.stdout, stderr: r.stderr, json };
    },
  };

  repo.write(".gitignore", ".claude/autopilot/\n");
  repo.write("PROJECT.md", PROJECT);
  repo.write("PROGRESS.md", progress());
  repo.write("DECISIONS.md", DECISIONS);
  repo.commit("chore: 기획");
  return repo;
};

const started = (t, options) => {
  const repo = makeRepo(t, options);
  const r = repo.run("start");
  assert.equal(r.code, 0, r.stdout + r.stderr);
  return repo;
};

const finishPhases = (repo) => {
  repo.write("PROGRESS.md", progress({ p1: "✅ 완료", v1: "/verify phase 1 — 통과", p2: "✅ 완료", v2: "/verify phase 2 — 통과" }));
  repo.commit("feat: phase 1 — 회원");
  repo.commit("feat: phase 2 — 주문");
};

const summary = (runId, { page = "https://claude.ai/artifact/x" } = {}) =>
  `\n## 🌙 무인 실행 결과 — run ${runId}\n\n- phase: ✅ 1, 2\n- 최종 검증: /verify full — 통과\n- 페이지: ${page}\n`;

// ── 꺼져 있을 때 ────────────────────────────────────────────

test("꺼져 있으면 Stop 도 도구도 건드리지 않는다", (t) => {
  const repo = makeRepo(t);
  assert.equal(repo.run("stop-hook").stdout, "");
  assert.equal(repo.run("pre-tool", { tool_name: "Bash", tool_input: { command: "git push origin main" } }).stdout, "");
});

// ── start ──────────────────────────────────────────────────

test("start: main 에서는 시작하지 않는다", (t) => {
  const repo = makeRepo(t, { branch: "main" });
  const r = repo.run("start");
  assert.equal(r.code, 1);
  assert.match(r.stdout, /git switch -c auto\//);
  assert.equal(repo.state(), null);
});

test("start: 커밋 안 된 변경이 있으면 시작하지 않는다", (t) => {
  const repo = makeRepo(t);
  repo.write("scratch.txt", "x");
  assert.equal(repo.run("start").code, 1);
  assert.equal(repo.state(), null);
});

test("start: PROJECT.md 에 phase 가 없으면 시작하지 않는다", (t) => {
  const repo = makeRepo(t);
  repo.write("PROJECT.md", "# PROJECT\n\n아직 없음\n");
  repo.commit("chore: 비움");
  assert.equal(repo.run("start").code, 1);
});

test("start: 이미 ✅ 인 phase 는 근거를 따지지 않는다", (t) => {
  const repo = makeRepo(t);
  repo.write("PROGRESS.md", progress({ p1: "✅ 완료" })); // 손으로 끝낸 phase — 검증 줄도 phase 커밋도 없다
  repo.commit("chore: 손으로 한 것");
  assert.equal(repo.run("start").code, 0);
  assert.deepEqual(repo.state().preDone, [1]);
  assert.match(repo.run("stop-hook").json.reason, /phase 2\/2 「주문」/);
});

// ── phase 진행 ─────────────────────────────────────────────

test("phase 0(준비)은 건너뛰고 phase 1 부터 지시한다", (t) => {
  const repo = started(t);
  const { json } = repo.run("stop-hook");
  assert.equal(json.decision, "block");
  assert.match(json.reason, /phase 1\/2 「회원」 을 시작한다/);
  assert.match(json.reason, /feat: phase 1 — 회원/);
});

test("🔄 이면 이어서 한다고 지시한다", (t) => {
  const repo = started(t);
  repo.write("PROGRESS.md", progress({ p1: "🔄 진행중" }));
  assert.match(repo.run("stop-hook").json.reason, /phase 1\/2 「회원」 을 이어서 한다/);
});

test("✅ 라고 적었어도 phase 커밋과 검증 줄이 없으면 넘어가지 않는다", (t) => {
  const repo = started(t);
  repo.write("PROGRESS.md", progress({ p1: "✅ 완료" }));
  repo.commit("chore: 표시만 바꿈");
  const { reason } = repo.run("stop-hook").json;
  assert.match(reason, /phase 1 「회원」 이 ✅ 인데 근거가 없다/);
  assert.match(reason, /커밋/);
  assert.match(reason, /검증:/);
});

test("phase 커밋과 검증 줄이 있으면 다음 phase 로 간다", (t) => {
  const repo = started(t);
  repo.write("PROGRESS.md", progress({ p1: "✅ 완료", v1: "/verify phase 1 — 기계 ✅ · 보안 ❌0 · 완료 기준 3/3" }));
  repo.commit("feat: phase 1 — 회원");
  assert.match(repo.run("stop-hook").json.reason, /phase 2\/2 「주문」 을 시작한다/);
});

test("시작 전 커밋의 'phase 1' 은 근거로 치지 않는다", (t) => {
  const repo = makeRepo(t);
  repo.commit("feat: phase 1 — 예전 시도");
  assert.equal(repo.run("start").code, 0);
  repo.write("PROGRESS.md", progress({ p1: "✅ 완료", v1: "통과" }));
  repo.commit("chore: 표시");
  assert.match(repo.run("stop-hook").json.reason, /근거가 없다: 커밋/);
});

// ── 상한 ───────────────────────────────────────────────────

test("진전 없이 3번 멈추면 그 phase 를 ❌ 로 적고 다음 phase 를 지시한다", (t) => {
  const repo = started(t);
  for (let i = 0; i < 3; i += 1) {
    const { reason } = repo.run("stop-hook").json;
    assert.match(reason, new RegExp(`진전 없음 ${i}/3`));
  }
  const { reason } = repo.run("stop-hook").json; // 4번째 — 3번 연속 그대로
  assert.match(reason, /phase 1 「회원」 을 ❌ 로 넘겼다 — 진전 없이 3번 연속 멈춤/);
  assert.match(reason, /git stash push -u -m "autopilot phase 1" -- \. ":\(exclude\)PROGRESS\.md"/);
  assert.match(reason, /phase 2\/2 「주문」 을 시작한다/);

  const entries = parseProgress(repo.read("PROGRESS.md"));
  assert.equal(entries.get(1).status, "❌");
  assert.equal(entries.get(2).status, "⬜");
  // ⛔ 절 안에 들어가야 한다 — 🔍 절 앞
  const decisions = repo.read("DECISIONS.md");
  const line = decisions.indexOf("phase 1 「회원」 — autopilot 이 ❌ 로 넘김");
  assert.ok(line > decisions.indexOf("## ⛔") && line < decisions.indexOf("## 🔍"), decisions);
});

test("게이트가 ❌ 로 넘긴 phase 는 PROGRESS.md 가 되돌려져도 다시 잡지 않는다", (t) => {
  const repo = started(t);
  for (let i = 0; i < 4; i += 1) repo.run("stop-hook"); // 4번째에 phase 1 ❌
  repo.write("PROGRESS.md", progress({ p1: "🔄 진행중" })); // stash 가 게이트의 표시까지 치운 경우
  assert.match(repo.run("stop-hook").json.reason, /phase 2\/2 「주문」/);
  assert.deepEqual(repo.state().failed, [1]);
});

test("파일이 바뀌고 있으면 진전으로 보지만, phase 턴 상한을 넘으면 ❌", (t) => {
  const repo = started(t);
  for (let i = 1; i <= 6; i += 1) {
    repo.write("work.txt", `step ${i}`);
    const { reason } = repo.run("stop-hook").json;
    assert.match(reason, /진전 없음 0\/3/);
    assert.match(reason, new RegExp(`phase-1 ${i}/6턴`));
  }
  repo.write("work.txt", "step 7");
  assert.match(repo.run("stop-hook").json.reason, /❌ 로 넘겼다 — 6턴 안에 끝나지 않음/);
});

test("마지막 phase 까지 ❌ 가 되면 마무리로 넘어간다", (t) => {
  const repo = started(t);
  repo.write("PROGRESS.md", progress({ p1: "✅ 완료", v1: "통과", p2: "🔄 진행중" }));
  repo.commit("feat: phase 1 — 회원");
  for (let i = 0; i < 3; i += 1) repo.run("stop-hook");
  assert.match(repo.run("stop-hook").json.reason, /❌ 로 넘겼다.*phase 가 전부 끝났다 \(✅ 1 · ❌ 1\)/s);
});

test("전체 턴 상한을 넘으면 끄고 보고하라고 한다", (t) => {
  const repo = started(t, { env: { AUTOPILOT_TOTAL_TURN_CAP: "2" } });
  repo.run("stop-hook");
  repo.run("stop-hook");
  assert.match(repo.run("stop-hook").json.reason, /\[autopilot 중단\] 총 2턴/);
  assert.equal(repo.state().active, false);
  assert.equal(repo.run("stop-hook").stdout, "");
});

test("PROJECT.md 가 사라지면 끄고 보고하라고 한다", (t) => {
  const repo = started(t);
  repo.remove("PROJECT.md");
  assert.match(repo.run("stop-hook").json.reason, /PROJECT\.md 가 없거나/);
  assert.equal(repo.state().active, false);
});

// ── 마무리 ─────────────────────────────────────────────────

test("phase 가 다 끝나면 마무리(요약 · 최종 검증 · 페이지)를 요구한다", (t) => {
  const repo = started(t);
  finishPhases(repo);
  const { reason } = repo.run("stop-hook").json;
  assert.match(reason, /phase 가 전부 끝났다 \(✅ 2 · ❌ 0\)/);
  assert.match(reason, new RegExp(`무인 실행 결과 — run ${repo.state().runId}`));
});

test("요약에 페이지 줄이 비어 있으면 아직 안 끝났다", (t) => {
  const repo = started(t);
  finishPhases(repo);
  repo.write("DECISIONS.md", DECISIONS + summary(repo.state().runId, { page: "" }));
  repo.commit("docs: 요약");
  const { reason } = repo.run("stop-hook").json;
  assert.match(reason, /`- 페이지:` 줄/);
  assert.doesNotMatch(reason, /최종 검증:` 줄/);
});

test("지난 run 의 요약으로는 끝나지 않는다", (t) => {
  const repo = started(t);
  finishPhases(repo);
  repo.write("DECISIONS.md", DECISIONS + summary("20000101-0000"));
  repo.commit("docs: 옛 요약");
  assert.match(repo.run("stop-hook").json.reason, /무인 실행 결과 — run .*" 절/);
});

test("커밋 안 된 변경이 있으면 끝나지 않는다", (t) => {
  const repo = started(t);
  finishPhases(repo);
  repo.write("DECISIONS.md", DECISIONS + summary(repo.state().runId));
  assert.match(repo.run("stop-hook").json.reason, /커밋 안 된 변경/);
});

test("요약까지 커밋되면 autopilot 을 끄고 멈추게 둔다", (t) => {
  const repo = started(t);
  finishPhases(repo);
  repo.write("DECISIONS.md", DECISIONS + summary(repo.state().runId));
  repo.commit("docs: 무인 실행 결과");
  const r = repo.run("stop-hook");
  assert.equal(r.stdout, "");
  assert.equal(repo.state().active, false);
  assert.equal(repo.state().stage, "done");
});

test("마무리가 상한 안에 안 끝나면 끄고 못 한 것을 보고하라고 한다", (t) => {
  const repo = started(t);
  finishPhases(repo);
  let last;
  for (let i = 0; i < 4; i += 1) {
    repo.write("note.txt", String(i)); // 진전은 있지만 끝나지 않는다
    last = repo.run("stop-hook").json.reason;
  }
  assert.match(last, /마무리 4\/4/);
  repo.write("note.txt", "5");
  assert.match(repo.run("stop-hook").json.reason, /\[autopilot 끝 — 마무리 미완\]/);
  assert.equal(repo.state().active, false);
});

// ── off · status ──────────────────────────────────────────

test("off 로 끄면 다음 Stop 은 그대로 멈춘다", (t) => {
  const repo = started(t);
  assert.match(repo.run("off").stdout, /autopilot 끔/);
  assert.equal(repo.run("stop-hook").stdout, "");
  assert.match(repo.run("status").stdout, /꺼짐/);
});

test("start 를 다시 부르면 같은 run 을 이어서 한다", (t) => {
  const repo = started(t);
  const { runId } = repo.state();
  repo.run("stop-hook");
  assert.match(repo.run("start").stdout, /이어서 한다/);
  assert.equal(repo.state().runId, runId);
  assert.equal(repo.state().stageTurns, 0);
});

// ── 넘지 않는 선 (PreToolUse) ─────────────────────────────

test("켜져 있으면 push 를 막고 이유를 돌려준다", (t) => {
  const repo = started(t);
  const { json } = repo.run("pre-tool", { tool_name: "Bash", tool_input: { command: "git push -u origin auto/test" } });
  assert.equal(json.hookSpecificOutput.permissionDecision, "deny");
  assert.match(json.hookSpecificOutput.permissionDecisionReason, /git push/);
  assert.equal(repo.run("pre-tool", { tool_name: "Bash", tool_input: { command: "git status" } }).stdout, "");
});

test("막는 명령과 통과시키는 명령", () => {
  const blocked = [
    "git push origin auto/x",
    "cd backend && git push",
    "git merge main",
    "git switch main",
    "git checkout master",
    "gh pr create --fill",
    "./infra/tf.ps1 apply",
    "./infra/.bin/1.9.0/terraform -chdir=infra apply -auto-approve",
    "aws ssm send-command --document-name x",
    "aws s3 sync dist s3://bucket",
    "bash infra/server/deploy.sh",
    "sudo /srv/app/rollback.sh",
  ];
  const allowed = [
    "git status",
    "git commit -m \"docs: git push 는 사람이 한다\"",
    "git switch -c auto/20261003-0100",
    "git stash push -u -m \"autopilot phase 3\"",
    "./infra/.bin/1.9.0/terraform -chdir=infra test",
    "bash -n infra/server/deploy_check.txt",
    "npm run e2e",
  ];
  for (const command of blocked) assert.ok(forbiddenReason(command), `막아야 함: ${command}`);
  for (const command of allowed) assert.equal(forbiddenReason(command), null, `통과해야 함: ${command}`);
});

// ── 읽기 ───────────────────────────────────────────────────

test("PROJECT.md: phase 0 은 빼고 번호순으로", () => {
  const phases = parsePhases("## phase 2: 주문\n## Phase 0: 준비\n## phase 1：회원\n## phase 10: 정산\n");
  assert.deepEqual(
    phases.map((p) => [p.n, p.name]),
    [
      [1, "회원"],
      [2, "주문"],
      [10, "정산"],
    ],
  );
});

test("PROGRESS.md: 옛 양식 '## N 단계' 와 양식 안내 줄도 읽는다", () => {
  const entries = parseProgress(
    "## 1 단계: 회원\n\n- 상태: ✅ 완료\n- 검증: 통과\n\n## phase 2: 주문\n\n- 상태: ⬜ 대기 / 🔄 진행중 / ✅ 완료 / ❌ 실패\n- 검증:\n",
  );
  assert.deepEqual(entries.get(1), { status: "✅", verify: "통과" });
  assert.deepEqual(entries.get(2), { status: "⬜", verify: "" });
});
