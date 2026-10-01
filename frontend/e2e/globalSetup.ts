import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { backendEnv } from "./env";
import { ADMIN } from "./helpers";

/**
 * 테스트 전에 한 번 — E2E DB 에 마이그레이션을 적용하고 관리자 계정을 만든다(이미 있으면 비밀번호를 맞춘다).
 * 둘 다 몇 번 돌려도 같은 결과다.
 */
export default function globalSetup() {
  const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../backend");
  const env = { ...backendEnv(), E2E_ADMIN_PASSWORD: ADMIN.password };
  const run = (cmd: string) => execSync(cmd, { cwd: backendDir, env, stdio: "inherit" });

  run("uv run alembic upgrade head");
  run(`uv run python -m scripts.create_admin ${ADMIN.email} --password-env E2E_ADMIN_PASSWORD --reset`);
}
