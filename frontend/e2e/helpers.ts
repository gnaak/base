import { expect, type BrowserContext, type Page } from "@playwright/test";
import { API_URL } from "./env";

const API = API_URL;

export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@example.com",
  password: process.env.E2E_ADMIN_PASSWORD ?? "e2e-admin-pass-1234",
};

/** 관리자 로그인 화면으로 들어가 로그인한다. 끝나면 `/admin` 에 있다. */
export const loginAdmin = async (page: Page) => {
  await page.goto("/admin/login");
  await page.getByPlaceholder("admin").fill(ADMIN.email);
  await page.getByPlaceholder("••••••••").fill(ADMIN.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/admin$/);
};

/** 새 사용자를 API 로 가입·로그인시킨다. 쿠키는 이 context 에 남는다 (localhost 는 포트를 가리지 않는다). */
export const loginNewUser = async (context: BrowserContext) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "e2e-user-pass-1234";
  const signup = await context.request.post(`${API}/api/auth/signup`, {
    data: { email, password, nickname: "e2e" },
  });
  expect(signup.status(), await signup.text()).toBe(201);
  const login = await context.request.post(`${API}/api/auth/login`, {
    data: { email, password, type: "user" },
  });
  expect(login.status(), await login.text()).toBe(200);
  return { email };
};

/** 프론트가 읽는 세션 쿠키(`{p}user_info`)와 같은 형식 — base64(UTF-8 JSON) */
export const userInfoCookie = (info: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(info), "utf-8").toString("base64");

export const cookieNames = async (context: BrowserContext) =>
  (await context.cookies()).map((c) => c.name);
