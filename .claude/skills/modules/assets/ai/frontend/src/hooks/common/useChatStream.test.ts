/**
 * useChatStream — 백엔드 `POST api/ai/chat` 의 SSE (text · error · done) 를 읽는 경로.
 * fetch 만 가짜로 바꾸고, 401 → refresh 1회 · 새로고침 금지는 다른 훅과 같은지 본다.
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_CODE } from "@/types/errorCode";

import { AuthExpiredError } from "./useAPI";
import { ChatStreamError, readSSE, useChatStream } from "./useChatStream";

const encoder = new TextEncoder();

/** 바이트 조각들을 그대로 흘리는 SSE 응답. signal 이 끊기면 스트림도 AbortError 로 끊는다. */
const sseResponse = (parts: (string | Uint8Array)[], { close = true, signal }: { close?: boolean; signal?: AbortSignal } = {}) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) controller.enqueue(typeof part === "string" ? encoder.encode(part) : part);
        if (close) controller.close();
        signal?.addEventListener("abort", () =>
          controller.error(new DOMException("aborted", "AbortError")),
        );
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );

const event = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Handler = (url: string, init?: RequestInit) => Response;

/** fetch 를 갈아끼우고 호출 기록(url · body)을 돌려준다. */
const stubFetch = (...handlers: Handler[]) => {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      const handler = handlers[Math.min(calls.length - 1, handlers.length - 1)];
      return Promise.resolve(handler(url, init));
    }),
  );
  return calls;
};

const HISTORY = [{ role: "user" as const, content: "안녕" }];

const send = async (onText: (t: string) => void = () => {}) => {
  const { result } = renderHook(() => useChatStream("user"));
  return result.current.sendMessage(HISTORY, onText);
};

beforeEach(() => {
  document.cookie = "user_user_info=abc;path=/";
  document.cookie = "user_refresh_exp=xyz;path=/";
});

describe("readSSE", () => {
  it("조각이 이벤트 중간 · 한글 글자 중간에서 잘려도 이벤트 단위로 모은다", async () => {
    const first = event("text", { text: "안녕하세요" });
    const bytes = encoder.encode(first + event("done", {}));
    const han = encoder.encode('event: text\ndata: {"text":"').length; // "안" 의 첫 바이트 위치
    const boundary = encoder.encode(first).length - 1; // 첫 이벤트의 "\n\n" 사이
    // "안" 의 3바이트 중간 · 두 줄바꿈 사이 · 다음 이벤트 중간에서 자른다
    const cut = [0, 5, han + 1, han + 2, boundary, bytes.length - 3, bytes.length];
    const parts = cut.slice(1).map((end, i) => bytes.slice(cut[i], end));

    const seen: [string, string][] = [];
    await readSSE(sseResponse(parts).body!, (name, data) => seen.push([name, data]));

    expect(seen).toEqual([
      ["text", JSON.stringify({ text: "안녕하세요" })],
      ["done", "{}"],
    ]);
  });
});

describe("useChatStream", () => {
  it("text 조각을 순서대로 넘기고 done 에서 끝난다", async () => {
    const calls = stubFetch(() =>
      sseResponse([event("text", { text: "안녕" }), event("text", { text: "줄\n바꿈" }), event("done", {})]),
    );
    const texts: string[] = [];

    await send((t) => texts.push(t));

    expect(texts).toEqual(["안녕", "줄\n바꿈"]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url.endsWith("/api/ai/chat")).toBe(true);
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.credentials).toBe("include");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ messages: HISTORY });
  });

  it("도중 error 이벤트는 ChatStreamError(AI_UNAVAILABLE) — 그 전 글자는 이미 넘어가 있다", async () => {
    stubFetch(() =>
      sseResponse([
        event("text", { text: "안녕" }),
        event("error", { message: "AI 응답을 받지 못했습니다.", errorCode: "AI_UNAVAILABLE" }),
      ]),
    );
    const texts: string[] = [];

    const err = await send((t) => texts.push(t)).catch((e) => e);

    expect(err).toBeInstanceOf(ChatStreamError);
    expect(err.errorCode).toBe(ERROR_CODE.AI_UNAVAILABLE);
    expect(err.status).toBe(200);
    expect(texts).toEqual(["안녕"]);
  });

  it("시작 전 실패(JSON)는 상태 · errorCode 를 담은 ChatStreamError", async () => {
    stubFetch(() =>
      json({ success: false, message: "요청이 너무 많습니다.", data: null, errorCode: "TOO_MANY_REQUESTS" }, 429),
    );

    const err = await send().catch((e) => e);

    expect(err).toBeInstanceOf(ChatStreamError);
    expect(err.status).toBe(429);
    expect(err.errorCode).toBe(ERROR_CODE.TOO_MANY_REQUESTS);
    expect(err.message).toBe("요청이 너무 많습니다.");
  });

  it("done 없이 스트림이 닫히면 끊김으로 본다", async () => {
    stubFetch(() => sseResponse([event("text", { text: "안" })]));

    const err = await send().catch((e) => e);

    expect(err).toBeInstanceOf(ChatStreamError);
    expect(err.errorCode).toBeNull();
  });

  it("401 이면 refresh 1회 후 같은 대화로 다시 보낸다", async () => {
    const calls = stubFetch(
      () => json({ success: false, errorCode: "ACCESS_TOKEN_EXPIRED" }, 401),
      () => json({ success: true, data: null }, 200), // refresh
      () => sseResponse([event("text", { text: "ok" }), event("done", {})]),
    );
    const texts: string[] = [];

    await send((t) => texts.push(t));

    expect(calls.map((c) => c.url.split("/").pop())).toEqual(["chat", "refresh_token", "chat"]);
    expect(calls[2].init?.body).toBe(calls[0].init?.body);
    expect(texts).toEqual(["ok"]);
  });

  it("refresh 도 실패하면 쿠키를 지우고 AuthExpiredError — 새로고침하지 않는다", async () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload, pathname: "/" },
    });
    stubFetch(() => json({ success: false }, 401));

    const err = await send().catch((e) => e);

    expect(err).toBeInstanceOf(AuthExpiredError);
    expect(document.cookie).not.toContain("user_user_info");
    expect(reload).not.toHaveBeenCalled();
  });

  it("abort 하면 에러 없이 끝나고 그 뒤 글자는 넘기지 않는다", async () => {
    stubFetch((_url, init) => sseResponse([event("text", { text: "첫" })], { close: false, signal: init?.signal ?? undefined }));
    const { result } = renderHook(() => useChatStream("user"));
    const texts: string[] = [];

    const pending = result.current.sendMessage(HISTORY, (t) => {
      texts.push(t);
      result.current.abort();
    });

    await expect(pending).resolves.toBeUndefined();
    expect(texts).toEqual(["첫"]);
  });
});
