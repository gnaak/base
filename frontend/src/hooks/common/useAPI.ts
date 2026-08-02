import { useMutation, useQuery, keepPreviousData } from "@tanstack/react-query";
import { useRef } from "react";

import { clearAuthCookies } from "@/hooks/common/getCookie";
import { AuthType } from "@/types/auth";

// baseURL 설정
export const baseURL = import.meta.env.VITE_APP_PUBLIC_BASE_URL;

// 공통 응답 타입
export interface BaseResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode: string;
}

/**
 * 세션이 완전히 끝났을 때(refresh까지 실패) 던지는 에러.
 * React Query 재시도 대상에서 제외되고, AuthProvider가 이 시점에 상태를 비운다.
 */
export class AuthExpiredError extends Error {
  readonly authType: AuthType;

  constructor(authType: AuthType) {
    super("세션이 만료되었습니다.");
    this.name = "AuthExpiredError";
    this.authType = authType;
  }
}

/** 세션 만료를 AuthProvider에 알리는 이벤트 이름. */
export const AUTH_EXPIRED_EVENT = "auth:expired";

/** 현재 경로 기준 refresh 대상. `/admin`으로 시작하면 admin. */
const currentAuthType = (): AuthType =>
  window.location.pathname.startsWith("/admin") ? "admin" : "user";

// 진행 중인 refresh 요청. 동시에 401이 여러 개 떠도 네트워크 호출은 타입당 1회만 나간다.
const pendingRefresh: Partial<Record<AuthType, Promise<boolean>>> = {};

/**
 * Refresh Token으로 세션을 갱신한다. (훅이 아니므로 어디서든 호출 가능)
 *
 * 쿠키 기반(refresh_token)이며 credentials: "include"로 요청된다.
 * throw 하지 않고 성공 여부만 boolean으로 돌려준다.
 * 같은 type의 요청이 이미 떠 있으면 그 Promise를 그대로 공유한다.
 *
 * @param type "user" | "admin" — 호출할 refresh 엔드포인트를 결정
 *
 * @example
 * const ok = await requestRefresh("admin");
 */
export const requestRefresh = (type: AuthType = "user"): Promise<boolean> => {
  const inflight = pendingRefresh[type];
  if (inflight) return inflight;

  const refreshUrl =
    type === "admin" ? "api/auth/refresh_token_admin" : "api/auth/refresh_token";

  const task = fetch(`${baseURL}/${refreshUrl}`, {
    method: "POST",
    credentials: "include",
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      delete pendingRefresh[type];
    });

  pendingRefresh[type] = task;
  return task;
};

/**
 * 세션을 만료 처리한다: 프론트 쿠키를 지우고 AuthProvider에 알린다.
 *
 * ⚠️ 여기서 절대 페이지를 새로고침하지 말 것.
 * 쿠키가 남은 채로 리로드하면 같은 401 → refresh 실패 → 리로드 루프가 돈다.
 * 쿠키를 지우면 user/admin 상태가 null이 되고, 라우트 가드가 알아서 로그인 화면으로 보낸다.
 */
const expireSession = (type: AuthType): AuthExpiredError => {
  clearAuthCookies(type);
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { type } }));
  return new AuthExpiredError(type);
};

/**
 * 401이면 refresh 후 딱 1회만 재시도한다.
 * refresh가 실패하거나 재시도도 401이면 세션을 만료 처리하고 AuthExpiredError를 던진다.
 */
const fetchWithRefresh = async (
  makeRequest: () => Promise<Response>,
  type: AuthType,
): Promise<Response> => {
  const response = await makeRequest();
  if (response.status !== 401) return response;

  const ok = await requestRefresh(type);
  if (!ok) throw expireSession(type);

  const retried = await makeRequest();
  if (retried.status === 401) throw expireSession(type);

  return retried;
};

/** 세션 만료 에러는 재시도해도 결과가 같으므로 즉시 포기한다. */
const retryExceptAuth = (failureCount: number, error: unknown) =>
  !(error instanceof AuthExpiredError) && failureCount < 3;

/**
 * 현재 경로를 기준으로 refresh 대상을 정하는 훅.
 *
 * ⚠️ 세션 상태를 Context에 반영해야 한다면 `useAuth().refreshAuth()`를 쓸 것.
 */
export const useRefreshToken = () => {
  const type = currentAuthType();
  return () => requestRefresh(type);
};

/**
 * React Query 기반 GET 요청 훅
 *
 * 401이면 refresh 후 1회 재시도한다. refresh까지 실패하면 세션을 만료 처리하고
 * `AuthExpiredError`를 던진다 (리다이렉트는 라우트 가드가 담당).
 *
 * @template T 응답 데이터의 타입
 *
 * @param url API endpoint (선행 슬래시 없이)
 * @param key React Query의 queryKey (배열 형태, 직렬화 가능한 값만 가능)
 * @param enabled 쿼리 실행 여부 (기본값: true)
 * @param authType refresh 대상. 기본값은 현재 경로로 판단 (`/admin` → admin)
 *
 * @example
 * const { data, isLoading, error } = useGet<User[]>("api/users", ["users"]);
 */
export const useGet = <T>(
  url: string,
  key: (string | number)[],
  enabled: boolean = true,
  authType: AuthType = currentAuthType(),
) => {
  return useQuery<T>({
    queryKey: key,
    enabled,
    queryFn: async () => {
      const response = await fetchWithRefresh(
        () => fetch(`${baseURL}/${url}`, { credentials: "include" }),
        authType,
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API 오류 ${response.status}: ${text}`);
      }

      const json = (await response.json()) as BaseResponse<T>;

      if (!json.success) {
        throw new Error(json.message || "API Error");
      }

      return json.data;
    },
    retry: retryExceptAuth,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  });
};

/**
 * React Query 기반 POST 요청 훅
 *
 * 401 처리는 `useGet`과 동일하다.
 *
 * @template TRequest 요청 바디 타입 (object, FormData, void)
 * @template TResponse 응답 데이터 타입
 * @template TError 에러 타입 (기본: { status?: number; message?: string })
 *
 * @param url API endpoint (선행 슬래시 없이)
 * @param authType refresh 대상. 기본값은 현재 경로로 판단
 *
 * @example
 * // JSON Body 요청
 * const createUser = usePost<{ name: string; email: string }, UserResponse>("api/users");
 * createUser.mutate({ name: "홍길동", email: "hong@example.com" });
 *
 * @example
 * // FormData 요청 (파일 업로드)
 * const uploadFile = usePost<FormData, { url: string }>("api/upload");
 * const fd = new FormData();
 * fd.append("file", fileInput.files[0]);
 * uploadFile.mutate(fd);
 *
 * @example
 * // 바디 없는 POST (예: 로그아웃)
 * const logout = usePost<void, void>("api/auth/logout");
 * logout.mutate();
 */
export const usePost = <
  TRequest extends object | FormData | void,
  TResponse,
  TError = { status?: number; message?: string },
>(
  url: string,
  authType: AuthType = currentAuthType(),
) => {
  return useMutation<TResponse, TError, TRequest>({
    mutationFn: async (body: TRequest) => {
      // 헤더 조건부
      const headers: HeadersInit = {};
      let fetchBody: BodyInit;

      if (body instanceof FormData) {
        fetchBody = body;
        // FormData면 Content-Type 자동 설정 (headers에 아무것도 안 넣음)
      } else {
        fetchBody = JSON.stringify(body);
        headers["Content-Type"] = "application/json";
      }

      const response = await fetchWithRefresh(
        () =>
          fetch(`${baseURL}/${url}`, {
            method: "POST",
            headers,
            credentials: "include",
            body: fetchBody,
          }),
        authType,
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = null;
        }
        throw {
          status: response.status,
          message: errorData?.message || errorText || "Something went wrong",
        } as TError;
      }

      // 204, 205 등 No Content 응답일 경우 안전하게 처리
      if (response.status === 204 || response.status === 205) {
        return null as unknown as TResponse;
      }

      const json = (await response.json()) as BaseResponse<TResponse>;

      if (!json.success) {
        throw {
          status: response.status,
          message: json.message || "API Error",
        } as TError;
      }

      return json.data;
    },
  });
};

export const usePatch = <
  TResponse,
  TRequest extends object | void = void,
  TError = { status?: number; message?: string },
>(
  url: string,
  authType: AuthType = currentAuthType(),
) => {
  return useMutation<TResponse, TError, TRequest>({
    mutationFn: async (body: TRequest) => {
      const response = await fetchWithRefresh(
        () =>
          fetch(`${baseURL}/${url}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
          }),
        authType,
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw { status: response.status, message: errorData?.message || "Error" } as TError;
      }

      if (response.status === 204) return null as unknown as TResponse;
      const json = (await response.json()) as BaseResponse<TResponse>;
      if (!json.success) throw { status: response.status, message: json.message } as TError;
      return json.data;
    },
  });
};

export const useDelete = <
  TResponse = void,
  TError = { status?: number; message?: string },
>(
  url: string,
  authType: AuthType = currentAuthType(),
) => {
  return useMutation<TResponse, TError, void>({
    mutationFn: async () => {
      const response = await fetchWithRefresh(
        () =>
          fetch(`${baseURL}/${url}`, {
            method: "DELETE",
            credentials: "include",
          }),
        authType,
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw { status: response.status, message: errorData?.message || "Error" } as TError;
      }

      if (response.status === 204) return null as unknown as TResponse;
      const json = (await response.json()) as BaseResponse<TResponse>;
      if (!json.success) throw { status: response.status, message: json.message } as TError;
      return json.data;
    },
  });
};

export const useChatStream = <TRequest extends object>(
  url: string,
  authType: AuthType = currentAuthType(),
) => {
  const controllerRef = useRef<AbortController | null>(null);

  const sendMessage = async (
    body: TRequest,
    onChunk: (chunk: string) => void,
  ) => {
    const controller = new AbortController();
    controllerRef.current = controller;

    const response = await fetchWithRefresh(
      () =>
        fetch(`${baseURL}/${url}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        }),
      authType,
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Chat API Error ${response.status}: ${text}`);
    }

    if (!response.body) throw new Error("No stream body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          onChunk(chunk);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Chat stream aborted");
      } else {
        throw err;
      }
    } finally {
      controllerRef.current = null;
    }
  };

  const abort = () => {
    controllerRef.current?.abort();
  };

  return { sendMessage, abort };
};
