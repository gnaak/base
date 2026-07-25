import { useMutation, useQuery, keepPreviousData } from "@tanstack/react-query";
import { useRef } from "react";

// baseURL 설정
export const hostname = window.location.hostname;

export const baseURL = import.meta.env.VITE_APP_PUBLIC_BASE_URL;

// 공통 응답 타입
export interface BaseResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode: string;
}

/**
 * Refresh Token으로 세션을 갱신한다. (훅이 아니므로 어디서든 호출 가능)
 *
 * 쿠키 기반(refresh_token)이며 credentials: "include"로 요청된다.
 * throw 하지 않고 성공 여부만 boolean으로 돌려준다.
 *
 * @param type "user" | "admin" — 호출할 refresh 엔드포인트를 결정
 *
 * @example
 * const ok = await requestRefresh("admin");
 */
export const requestRefresh = async (
  type: "user" | "admin" = "user",
): Promise<boolean> => {
  const refreshUrl =
    type === "admin" ? "api/auth/refresh_token_admin" : "api/auth/refresh_token";

  const response = await fetch(`${baseURL}/${refreshUrl}`, {
    method: "POST",
    credentials: "include",
  });

  return response.ok;
};

/**
 * 현재 경로를 기준으로 refresh 대상을 정하는 훅.
 * `/admin`으로 시작하면 admin refresh API를, 그 외에는 user refresh API를 호출한다.
 *
 * ⚠️ 세션 상태를 Context에 반영해야 한다면 `useAuth().refreshAuth()`를 쓸 것.
 * 이 훅은 useGet/usePost 내부의 401 재시도 전용이다.
 *
 * @example
 * const refreshToken = useRefreshToken();
 * await refreshToken();
 */
export const useRefreshToken = () => {
  const type = window.location.pathname.startsWith("/admin") ? "admin" : "user";

  return () => requestRefresh(type);
};

/**
 * React Query 기반 GET 요청 훅
 *
 * 자동으로 401 응답 시 refreshToken()을 호출하고,
 * 재시도까지 해주는 fetch 래퍼입니다.
 *
 * @template T 응답 데이터의 타입
 *
 * @param url API endpoint
 * @param key React Query의 queryKey (배열 형태, 직렬화 가능한 값만 가능)
 * @param enabled 쿼리 실행 여부 (기본값: true)
 * @param fallback refresh token 갱신 실패 시 돌아갈 url
 * @example
 * const { data, isLoading, error } = useGet<User[]>("/users", ["users"]);
 */
export const useGet = <T>(
  url: string,
  key: (string | number)[],
  enabled: boolean = true,
  fallback: string = "/",
) => {
  const refreshToken = useRefreshToken();

  return useQuery<T>({
    queryKey: key,
    enabled,
    queryFn: async () => {
      const makeRequest = async () => {
        return await fetch(`${baseURL}/${url}`, {
          credentials: "include",
        });
      };

      let response = await makeRequest();

      if (response.status === 401) {
        const ok = await refreshToken();
        if (!ok) {
          window.location.href = fallback;
          return;
        }
        response = await makeRequest();
      }

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
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  });
};

/**
 * React Query 기반 POST 요청 훅
 *
 * 자동으로 401 응답 시 refreshToken()을 호출하고,
 * 재시도까지 해주는 fetch 래퍼입니다.
 *
 * @template TResponse 응답 데이터 타입
 * @template TRequest 요청 바디 타입 (object, FormData, void)
 * @template TError 에러 타입 (기본: { status?: number; message?: string })
 *
 * @param url API endpoint
 * @param fallback refresh token 갱신 실패 시 돌아갈 url
 *
 * @example
 * // JSON Body 요청
 * const createUser = usePost<UserResponse, { name: string; email: string }>("/users");
 * createUser.mutate({ name: "홍길동", email: "hong@example.com" });
 *
 * @example
 * // FormData 요청 (파일 업로드)
 * const uploadFile = usePost<{ url: string }, FormData>("/upload");
 * const fd = new FormData();
 * fd.append("file", fileInput.files[0]);
 * uploadFile.mutate(fd);
 *
 * @example
 * // 바디 없는 POST (예: 로그아웃)
 * const logout = usePost<void, void>("/auth/logout");
 * logout.mutate();
 */
export const usePost = <
  TRequest extends object | FormData | void,
  TResponse,
  TError = { status?: number; message?: string },
>(
  url: string,
  fallback: string = "/",
) => {
  const refreshToken = useRefreshToken();

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

      const makeRequest = async () => {
        return await fetch(`${baseURL}/${url}`, {
          method: "POST",
          headers,
          credentials: "include",
          body: fetchBody,
        });
      };

      let response = await makeRequest();

      if (response.status === 401) {
        const ok = await refreshToken();
        if (!ok) {
          window.location.href = fallback;
          throw new Error("세션 만료");
        }
        response = await makeRequest();
      }

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
  fallback: string = "/",
) => {
  const refreshToken = useRefreshToken();

  return useMutation<TResponse, TError, TRequest>({
    mutationFn: async (body: TRequest) => {
      const makeRequest = async () =>
        fetch(`${baseURL}/${url}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });

      let response = await makeRequest();

      if (response.status === 401) {
        const ok = await refreshToken();
        if (!ok) { window.location.href = fallback; throw new Error("세션 만료"); }
        response = await makeRequest();
      }

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
  fallback: string = "/",
) => {
  const refreshToken = useRefreshToken();

  return useMutation<TResponse, TError, void>({
    mutationFn: async () => {
      const makeRequest = async () =>
        fetch(`${baseURL}/${url}`, {
          method: "DELETE",
          credentials: "include",
        });

      let response = await makeRequest();

      if (response.status === 401) {
        const ok = await refreshToken();
        if (!ok) { window.location.href = fallback; throw new Error("세션 만료"); }
        response = await makeRequest();
      }

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


export const useChatStream = <TRequest extends object>(url: string) => {
  const refreshToken = useRefreshToken();
  const controllerRef = useRef<AbortController | null>(null);

  const sendMessage = async (
    body: TRequest,
    onChunk: (chunk: string) => void,
  ) => {
    const controller = new AbortController();
    controllerRef.current = controller;

    const makeRequest = async () =>
      fetch(`${baseURL}/${url}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

    let response = await makeRequest();

    if (response.status === 401) {
      await refreshToken();
      response = await makeRequest();
    }

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
      if (err.name === "AbortError") {
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
