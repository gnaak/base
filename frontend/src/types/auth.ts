import { UserInfo } from "./user";

export type AuthType = "user" | "admin";

export type AuthContextType = {
  /** 일반 사용자 세션 (user_ 쿠키) */
  user: UserInfo | null;
  /** 관리자 세션 (admin_ 쿠키) */
  admin: UserInfo | null;
  isLoading: boolean;
  setUser: (user: UserInfo | null) => void;
  setAdmin: (admin: UserInfo | null) => void;
  /**
   * 쿠키를 다시 읽어 Context 상태에 반영한다.
   * 로그인/콜백 직후처럼 서버가 새 쿠키를 내려준 시점에 호출.
   */
  syncAuth: (type?: AuthType) => UserInfo | null;
  /**
   * refresh API를 호출한 뒤 쿠키를 재동기화한다.
   * 갱신된 세션을 반환하고, 실패하면 null을 반환한다.
   * 같은 타입의 요청이 이미 진행 중이면 그 Promise를 그대로 돌려준다.
   */
  refreshAuth: (type?: AuthType) => Promise<UserInfo | null>;
};
