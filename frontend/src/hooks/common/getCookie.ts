import { AuthType } from "@/types/auth";
import { UserInfo } from "@/types/user";

const cookiePrefix = (authType: AuthType) =>
  authType === "admin" ? "admin_" : "user_";

const getCookie = (name: string): string | undefined => {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]*)`));
  return match ? match[2].trim() : undefined;
};

/** `{user|admin}_user_info` 쿠키(base64 JSON)를 파싱한다. */
export const parseUserInfo = (authType: AuthType = "user"): UserInfo | null => {
  const cookie = getCookie(`${cookiePrefix(authType)}user_info`);
  if (!cookie) return null;

  try {
    const binary = atob(cookie.replace(/^"|"$/g, ""));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const decoded = new TextDecoder("utf-8").decode(bytes);
    return JSON.parse(decoded) as UserInfo;
  } catch (e) {
    console.error("쿠키 파싱 실패:", e);
    return null;
  }
};

/**
 * refresh 세션이 아직 살아 있는지 확인한다.
 * `{user|admin}_refresh_exp` 쿠키의 존재 여부만 본다 (access 쿠키보다 수명이 길다).
 */
export const refreshExp = (authType: AuthType = "user"): boolean =>
  getCookie(`${cookiePrefix(authType)}refresh_exp`) !== undefined;

/**
 * 프론트가 읽을 수 있는 세션 쿠키(`user_info`, `refresh_exp`)를 지운다.
 *
 * refresh까지 실패했을 때 반드시 호출해야 한다. 이걸 안 하면 `parseUserInfo()`가
 * 계속 유저를 돌려주고, 앱은 로그인 상태라고 믿은 채 401 → refresh 실패를 반복한다.
 * (access/refresh 토큰은 httponly라 JS로 못 지우지만, 이 시점엔 이미 무효라 상관없다.)
 */
export const clearAuthCookies = (authType: AuthType = "user") => {
  const prefix = cookiePrefix(authType);

  // 쿠키는 (name, domain, path)가 모두 일치해야 덮어쓸 수 있다.
  // prod에서는 백엔드가 domain 속성을 붙여 심으므로 상위 도메인 후보를 함께 시도한다.
  // (매칭되지 않는 domain 값은 브라우저가 무시하므로 안전하다)
  const parts = window.location.hostname.split(".");
  const scopes = [""];
  for (let i = 0; i < parts.length - 1; i++) {
    scopes.push(`;domain=${parts.slice(i).join(".")}`);
  }

  for (const name of [`${prefix}user_info`, `${prefix}refresh_exp`]) {
    for (const scope of scopes) {
      document.cookie = `${name}=;max-age=0;path=/${scope}`;
    }
  }
};
