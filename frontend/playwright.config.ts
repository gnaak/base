import { defineConfig, devices } from "@playwright/test";
import { API_PORT, API_URL, WEB_PORT, WEB_URL, backendEnv } from "./e2e/env";

/**
 * 브라우저 E2E — 단위 테스트로는 안 보이는 것(새로고침 루프, 쿠키, 화면 전환)을 진짜 브라우저로 본다.
 *
 * 백엔드·프론트를 **E2E 전용 포트(8100/3100)·전용 DB·Redis 번호**로 직접 띄운다 — 개발 서버·개발 DB 와 섞이지 않게.
 * 이미 떠 있는 서버는 재사용하지 않는다 (다른 프로젝트 서버를 테스트하는 사고를 막는다).
 *
 * | 변수 | 기본값 | 뜻 |
 * | --- | --- | --- |
 * | E2E_WEB_PORT / E2E_API_PORT | 3100 / 8100 | 띄울 포트 |
 * | E2E_MYSQL_DB | db_base_e2e | 백엔드 LOCAL_MYSQL_DB. 한 번 만들어 둘 것 (README "E2E") |
 * | E2E_REDIS_DB | 15 | 백엔드 REDIS_DB — 다른 프로젝트와 같은 Redis 를 쓰면 키가 섞이지 않게 |
 * | E2E_REDIS_PASSWORD | (비움) | 백엔드 LOCAL_REDIS_PASSWORD |
 * | E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD | e2e-admin@example.com / e2e-admin-pass-1234 | globalSetup 이 만든다 |
 *
 * 로그인 빈도 제한(IP 10회/분) 때문에 한 줄로(workers 1) 돌리고 재시도하지 않는다.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/globalSetup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `uv run uvicorn app.main:app --host localhost --port ${API_PORT}`,
      cwd: "../backend",
      url: `${API_URL}/api/health`,
      env: backendEnv(),
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      // .env 의 값보다 이미 있는 환경변수가 우선한다 (Vite) — 프론트가 E2E 백엔드를 부르게
      env: { ...(process.env as Record<string, string>), VITE_APP_PUBLIC_BASE_URL: API_URL },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
