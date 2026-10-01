import { expect, test } from "@playwright/test";
import { cookieNames, loginNewUser, userInfoCookie } from "./helpers";

/**
 * 이 템플릿에서 반복해서 터진 버그 — "무한 새로고침".
 * user_info 쿠키가 남아 있으면 프론트는 로그인 상태로 믿는데, 토큰이 무효라 API 는 401 을 준다.
 * 그때 페이지를 새로고침하면 쿠키가 그대로라 루프가 돈다 (루트 CLAUDE.md "무한 새로고침 주의").
 */
test("죽은 세션 쿠키가 남아 있어도 새로고침 루프가 돌지 않고 로그아웃 상태로 정리된다", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "user_user_info",
      value: userInfoCookie({ auth_type: "user", id: 999999, user_nickname: "ghost", created_at: null }),
      domain: "localhost",
      path: "/",
    },
    // refresh 마커까지 있으면 프론트는 refresh 를 한 번 시도한다 — 그것도 실패해야 한다
    { name: "user_refresh_exp", value: "1", domain: "localhost", path: "/" },
  ]);

  // 페이지 **재로드**만 센다 — 화면 안의 라우트 이동(history API)은 루프가 아니다
  let loads = 0;
  page.on("load", () => {
    loads += 1;
  });
  let meCalls = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/user/me")) meCalls += 1;
  });

  await page.goto("/");
  // 새로고침되면 사라지는 표식 — 끝까지 남아 있어야 한다
  await page.evaluate(() => {
    (window as unknown as { __e2eMarker: number }).__e2eMarker = 1;
  });
  // 세션 정리가 끝날 때까지 — 프론트가 지우는 쿠키가 사라지면 끝난 것이다
  await expect.poll(async () => (await cookieNames(context)).includes("user_user_info"), { timeout: 10_000 }).toBe(false);
  await page.waitForTimeout(1500); // 루프가 있다면 이 사이에 다시 불러오거나 다시 부른다

  expect(loads, "페이지를 다시 불러오면 안 된다").toBe(1);
  expect(
    await page.evaluate(() => (window as unknown as { __e2eMarker?: number }).__e2eMarker),
    "페이지가 다시 로드되면 표식이 사라진다",
  ).toBe(1);
  expect(meCalls, "401 뒤에 같은 API 를 계속 부르면 안 된다").toBeLessThanOrEqual(2);
  expect(await cookieNames(context)).not.toContain("user_refresh_exp");
});

test("access 쿠키만 없어졌으면 refresh 로 조용히 다시 로그인된다", async ({ page, context }) => {
  await loginNewUser(context);
  await context.clearCookies({ name: "user_access_token" });

  const me = page.waitForResponse((res) => res.url().includes("/api/user/me") && res.status() === 200);
  await page.goto("/");
  await me;

  expect(await cookieNames(context)).toContain("user_access_token");
  expect(await cookieNames(context)).toContain("user_user_info");
});
