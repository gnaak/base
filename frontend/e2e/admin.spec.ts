import { expect, test } from "@playwright/test";
import { cookieNames, loginAdmin } from "./helpers";

test("관리자 로그인 → /admin, 새로고침해도 로그인이 유지된다", async ({ page }) => {
  await loginAdmin(page);
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
});

test("로그아웃하면 세션 쿠키가 지워지고 /admin 에 다시 못 들어간다", async ({ page, context }) => {
  await loginAdmin(page);

  await page.getByRole("button", { name: "로그아웃" }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).last().click(); // 확인 모달

  await expect(page).toHaveURL(/\/admin\/login$/);
  const names = await cookieNames(context);
  for (const name of ["admin_access_token", "admin_refresh_token", "admin_user_info", "admin_refresh_exp"]) {
    expect(names, name).not.toContain(name);
  }

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("테마 버튼으로 다크모드가 켜지고 새로고침해도 유지된다", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await loginAdmin(page);
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains("dark"));
  expect(await isDark()).toBe(false);

  // 시스템 → 라이트 → 다크
  const toggle = page.getByRole("button", { name: /^테마:/ });
  await toggle.click();
  await toggle.click();
  expect(await isDark()).toBe(true);

  await page.reload(); // index.html 의 첫 페인트 스크립트가 같은 값을 읽는다
  expect(await isDark()).toBe(true);
});

test("좁은 화면에서는 메뉴 버튼이 사이드바를 드로어로 연다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAdmin(page);

  const drawer = page.getByRole("dialog", { name: "관리자 메뉴" });
  await expect(drawer).toBeHidden();

  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "대시보드" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

test("없는 관리자 경로는 사이드바가 있는 채로 404", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/does-not-exist");

  await expect(page.getByText("페이지를 찾을 수 없어요")).toBeVisible();
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
});
