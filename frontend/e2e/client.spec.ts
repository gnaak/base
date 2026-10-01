import { expect, test } from "@playwright/test";
import { cookieNames, loginNewUser } from "./helpers";

test("로그인 전 첫 화면에는 소셜 로그인 카드가 있다", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "시작하기" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Google로 계속하기/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /카카오로 계속하기/ })).toBeVisible();
});

test("로그인하면 첫 화면이 인사로 바뀌고, 로그아웃하면 쿠키가 지워진 채 로그인 카드로 돌아온다", async ({
  page,
  context,
}) => {
  await loginNewUser(context);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /님, 반가워요$/ })).toBeVisible();

  await page.getByRole("button", { name: "로그아웃" }).click();

  await expect(page.getByRole("heading", { name: "시작하기" })).toBeVisible();
  const names = await cookieNames(context);
  for (const name of ["user_access_token", "user_refresh_token", "user_user_info", "user_refresh_exp"]) {
    expect(names, name).not.toContain(name);
  }
});

test("첫 화면의 토글로도 다크모드가 켜진다", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  await page.getByRole("button", { name: "다크 모드" }).click();
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
});
