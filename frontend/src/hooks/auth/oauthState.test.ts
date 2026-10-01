import { afterEach, describe, expect, it, vi } from "vitest";
import { beginOAuth, consumeOAuthState, safeNext } from "./oauthState";

afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});

describe("OAuth state", () => {
  it("같은 state 가 돌아오면 통과하고 next 를 돌려준다", () => {
    const state = beginOAuth("kakao", "/orders/1");
    expect(consumeOAuthState("kakao", state)).toEqual({ ok: true, next: "/orders/1" });
  });

  it("다른 state 면 거부한다 — 공격자가 만든 콜백 링크", () => {
    beginOAuth("kakao");
    expect(consumeOAuthState("kakao", "attacker-state")).toEqual({ ok: false });
  });

  it("state 가 없으면 거부한다", () => {
    beginOAuth("google");
    expect(consumeOAuthState("google", null)).toEqual({ ok: false });
  });

  it("로그인을 시작한 적이 없으면 거부한다 — 링크만 받은 피해자", () => {
    expect(consumeOAuthState("kakao", "anything")).toEqual({ ok: false });
  });

  it("다른 업체로 시작한 state 는 쓸 수 없다", () => {
    const state = beginOAuth("google");
    expect(consumeOAuthState("kakao", state)).toEqual({ ok: false });
  });

  it("한 번 쓰면 다시 쓸 수 없다", () => {
    const state = beginOAuth("kakao");
    expect(consumeOAuthState("kakao", state).ok).toBe(true);
    expect(consumeOAuthState("kakao", state)).toEqual({ ok: false });
  });

  it("10분이 지나면 거부한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T00:00:00Z"));
    const state = beginOAuth("kakao");
    vi.setSystemTime(new Date("2026-10-02T00:10:01Z"));
    expect(consumeOAuthState("kakao", state)).toEqual({ ok: false });
  });

  it("매번 다른 state 를 만든다", () => {
    expect(beginOAuth("kakao")).not.toBe(beginOAuth("kakao"));
  });
});

describe("safeNext — 같은 오리진 경로만", () => {
  it.each([
    ["/orders/1", "/orders/1"],
    ["/", "/"],
    ["/a?b=c#d", "/a?b=c#d"],
  ])("%s 는 허용", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "orders",
    "",
  ])("%s 는 거부", (input) => {
    expect(safeNext(input)).toBeNull();
  });

  it("next 가 이상하면 state 는 통과해도 next 는 버린다", () => {
    const state = beginOAuth("google", "//evil.com");
    expect(consumeOAuthState("google", state)).toEqual({ ok: true, next: null });
  });
});
