import { useRef } from "react";

import { BaseResponse, baseURL, currentAuthType, fetchWithRefresh } from "@/hooks/common/useAPI";
import { ChatMessage } from "@/types/ai";
import { AuthType } from "@/types/auth";

/**
 * AI 채팅 실패. 시작 전(HTTP 4xx·5xx JSON)이든 도중(SSE `error` 이벤트)이든 이걸로 던진다.
 *
 * - `status` — 시작 전이면 HTTP 상태(429 · 502 · 503 …), 도중이면 200
 * - `errorCode` — `ERROR_CODE.AI_UNAVAILABLE` · `TOO_MANY_REQUESTS` · `VALIDATION_ERROR` 등. 끊김이면 null
 */
export class ChatStreamError extends Error {
  readonly status: number;
  readonly errorCode: string | null;

  constructor(message: string, status: number, errorCode: string | null) {
    super(message);
    this.name = "ChatStreamError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

/**
 * SSE 바이트 스트림을 이벤트 단위로 읽어 `onEvent(이벤트 이름, data 문자열)` 을 부른다.
 * 네트워크 조각이 이벤트 중간·한글(UTF-8) 글자 중간에서 잘려 와도 된다.
 * 백엔드는 줄 끝을 `\n` 으로만 보낸다. `onEvent` 가 던지면 스트림을 닫고 그대로 던진다.
 */
export const readSSE = async (
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: string) => void,
): Promise<void> => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (block: string) => {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (data.length > 0) onEvent(event, data.join("\n"));
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let end = buffer.indexOf("\n\n");
      while (end !== -1) {
        dispatch(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
        end = buffer.indexOf("\n\n");
      }
    }
  } catch (err) {
    await reader.cancel().catch(() => undefined);
    throw err;
  }
};

/**
 * AI 채팅 — `POST api/ai/chat` 의 SSE 를 읽는다 (백엔드 `module/ai/ai_service.py` 맨 위와 1:1).
 *
 * - 대화 전체를 보낸다 (서버는 기억하지 않는다). 마지막은 user 메시지여야 한다
 * - 401 이면 다른 훅과 같이 refresh 1회 후 재시도, 그래도 안 되면 `AuthExpiredError` (새로고침 없음)
 * - 실패는 `ChatStreamError` — 시작 전(429 · 502/503 `AI_UNAVAILABLE` …)이든 도중(`error` 이벤트)이든.
 *   도중에 실패해도 그때까지의 글자는 이미 `onText` 로 넘어가 있다
 * - `abort()` 로 멈추면 에러 없이 끝난다. 새 `sendMessage` 는 앞의 스트림을 끊는다
 *
 * @example
 * const { sendMessage, abort } = useChatStream();
 * setAnswer("");
 * await sendMessage([...history, { role: "user", content: input }], (t) => setAnswer((a) => a + t));
 */
export const useChatStream = (authType: AuthType = currentAuthType()) => {
  const controllerRef = useRef<AbortController | null>(null);

  const sendMessage = async (
    messages: ChatMessage[],
    onText: (text: string) => void,
  ): Promise<void> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await fetchWithRefresh(
        () =>
          fetch(`${baseURL}/api/ai/chat`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages }),
            signal: controller.signal,
          }),
        authType,
      );

      if (!response.ok || !response.body) {
        const json = (await response.json().catch(() => null)) as BaseResponse<null> | null;
        throw new ChatStreamError(
          json?.message || `AI 요청 실패 (${response.status})`,
          response.status,
          json?.errorCode ?? null,
        );
      }

      let done = false;
      await readSSE(response.body, (event, data) => {
        const payload = JSON.parse(data);
        if (event === "text") onText(payload.text);
        else if (event === "error") throw new ChatStreamError(payload.message, 200, payload.errorCode);
        else if (event === "done") done = true;
      });
      if (!done) throw new ChatStreamError("응답이 중간에 끊겼습니다.", 200, null);
    } catch (err) {
      if (controller.signal.aborted) return; // 사용자가 멈춘 것 — 에러가 아니다
      throw err;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const abort = () => {
    controllerRef.current?.abort();
  };

  return { sendMessage, abort };
};
