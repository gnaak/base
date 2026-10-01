/**
 * E2E 전용 포트·DB. 개발 서버(3000/8000)와 겹치지 않게 따로 띄운다 —
 * 같은 PC 에서 다른 프로젝트가 3000/8000 을 쓰고 있으면, 그 서버를 테스트하게 되는 사고가 난다.
 */
export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3100);
export const API_PORT = Number(process.env.E2E_API_PORT ?? 8100);
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const API_URL = `http://localhost:${API_PORT}`;

/** 백엔드에 넘길 환경변수 — .env 보다 우선한다 (pydantic-settings). .env 파일은 건드리지 않는다 */
export const backendEnv = (): Record<string, string> => ({
  ...(process.env as Record<string, string>),
  APP_ENV: "local",
  LOCAL_MYSQL_DB: process.env.E2E_MYSQL_DB ?? "db_base_e2e",
  REDIS_DB: process.env.E2E_REDIS_DB ?? "15",
  LOCAL_REDIS_PASSWORD: process.env.E2E_REDIS_PASSWORD ?? "",
  // CORS 허용 오리진 — 프론트를 E2E 포트로 띄우므로
  LOCAL_DOMAIN: `localhost:${WEB_PORT}`,
});
