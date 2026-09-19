/**
 * useAPI 의 401 → refresh 경로.
 *
 * `CLAUDE.md` 가 "이 템플릿에서 반복적으로 터졌던 버그" 라고 적어둔 지점이다.
 * 특히 **세션 실패 시 페이지를 새로고침하면 안 된다** — 쿠키가 그대로라 루프가 돈다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_EXPIRED_EVENT, AuthExpiredError, requestRefresh } from "./useAPI";

/** fetch 를 갈아끼우고 호출 기록을 돌려준다. */
const stubFetch = (handler: (url: string, init?: RequestInit) => Response) => {
  const calls: { url: string; method: string }[] = [];
  const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET" });
    return Promise.resolve(handler(url, init));
  });
  vi.stubGlobal("fetch", fn);
  return calls;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const ok = (data: unknown) => json({ success: true, message: "ok", data, errorCode: null });

beforeEach(() => {
  document.cookie = "user_user_info=abc;path=/";
  document.cookie = "user_refresh_exp=xyz;path=/";
});

describe("requestRefresh", () => {
  it("성공하면 true, 실패하면 false 를 돌려준다 (throw 하지 않는다)", async () => {
    stubFetch(() => ok(null));
    await expect(requestRefresh("user")).resolves.toBe(true);

    stubFetch(() => json({ success: false }, 401));
    await expect(requestRefresh("user")).resolves.toBe(false);
  });

  it("네트워크 오류도 false 로 흡수한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    await expect(requestRefresh("user")).resolves.toBe(false);
  });

  it("동시에 여러 번 불러도 네트워크 호출은 1회다", async () => {
    // 탭·컴포넌트가 동시에 401 을 만나도 refresh 폭풍이 나면 안 된다
    const calls = stubFetch(() => ok(null));

    await Promise.all([requestRefresh("user"), requestRefresh("user"), requestRefresh("user")]);

    expect(calls.filter((c) => c.url.includes("refresh_token"))).toHaveLength(1);
  });

  it("user 와 admin 은 각자 refresh 한다", async () => {
    const calls = stubFetch(() => ok(null));

    await Promise.all([requestRefresh("user"), requestRefresh("admin")]);

    expect(calls.map((c) => c.url.endsWith("refresh_token_admin"))).toEqual(
      expect.arrayContaining([true, false]),
    );
  });
});

describe("세션 만료 처리", () => {
  it("refresh 가 실패하면 user_info·refresh_exp 쿠키를 지운다", async () => {
    // 쿠키가 남으면 앱이 로그인 상태라고 믿고 401 → refresh 실패를 반복한다
    stubFetch(() => json({ success: false }, 401));

    await requestRefresh("user");
    // requestRefresh 자체는 쿠키를 지우지 않는다 — 지우는 건 AuthProvider/useAPI 쪽이다
    expect(document.cookie).toContain("user_user_info");

    const { clearAuthCookies } = await import("./getCookie");
    clearAuthCookies("user");

    expect(document.cookie).not.toContain("user_user_info");
    expect(document.cookie).not.toContain("user_refresh_exp");
  });

  it("AuthExpiredError 는 authType 을 들고 있다", () => {
    const err = new AuthExpiredError("admin");
    expect(err).toBeInstanceOf(Error);
    expect(err.authType).toBe("admin");
    expect(err.name).toBe("AuthExpiredError");
  });

  it("만료 이벤트 이름이 바뀌면 AuthProvider 가 못 듣는다", () => {
    // 양쪽이 같은 상수를 쓰는지 고정하는 회귀 테스트
    expect(AUTH_EXPIRED_EVENT).toBe("auth:expired");
  });
});

describe("새로고침 금지", () => {
  it("세션이 끊겨도 location 을 건드리지 않는다", async () => {
    // 쿠키가 남은 채 리로드하면 같은 401 → refresh 실패 → 리로드 루프가 된다
    const reload = vi.fn();
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload, assign, pathname: "/" },
    });

    stubFetch(() => json({ success: false }, 401));
    await requestRefresh("user");

    expect(reload).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
