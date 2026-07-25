import { AuthType } from "@/types/auth";
import { UserInfo } from "@/types/user";

const getCookie = (name: string): string | undefined => {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]*)`));
  return match ? match[2].trim() : undefined;
};

/** `{user|admin}_user_info` 쿠키(base64 JSON)를 파싱한다. */
export const parseUserInfo = (authType: AuthType = "user"): UserInfo | null => {
  const prefix = authType === "admin" ? "admin_" : "user_";
  const cookie = getCookie(`${prefix}user_info`);
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
export const refreshExp = (authType: AuthType = "user"): boolean => {
  const prefix = authType === "admin" ? "admin_" : "user_";
  return getCookie(`${prefix}refresh_exp`) !== undefined;
};
