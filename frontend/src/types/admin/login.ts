import { UserInfo } from "@/types/user";

// POST api/auth/login 요청 바디
// 백엔드 `auth_schema.LoginIn`과 1:1. type은 백엔드가 Literal로 막고 있다
// (다른 값을 보내면 422 VALIDATION_ERROR).
export interface LoginRequest {
  email: string;
  password: string;
  type: "user" | "admin";
}

// POST api/auth/login 응답의 data
// 백엔드 `auth_schema.SessionOut`과 1:1이고, `{p}user_info` 쿠키에 담기는 내용과 같다.
// 그래서 쿠키를 파싱하지 않고도 로그인 직후 세션 정보를 바로 쓸 수 있다.
export type LoginResponse = UserInfo;
