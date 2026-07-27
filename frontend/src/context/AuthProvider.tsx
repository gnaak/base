// src/context/AuthProvider.tsx

import { useCallback, useEffect, useState, ReactNode } from "react";
import { clearAuthCookies, parseUserInfo } from "@/hooks/common/getCookie";
import { AUTH_EXPIRED_EVENT, requestRefresh } from "@/hooks/common/useAPI";
import { AuthContext } from "@/hooks/common/useAuth";
import { AuthType } from "@/types/auth";
import { UserInfo } from "@/types/user";

/**
 * 쿠키에 저장된 세션 정보를 읽어 user(일반) / admin(관리자) 상태를 전역 Context로 제공한다.
 *
 * 쿠키는 그 자체로 반응형이 아니기 때문에, 서버가 새 쿠키를 내려준 시점(로그인·콜백·refresh)에
 * `syncAuth()` / `refreshAuth()`로 상태를 다시 맞춰줘야 한다.
 * 이 두 함수가 있어서 페이지를 통째로 새로고침(window.location.reload)할 필요가 없다.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [admin, setAdmin] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncAuth = useCallback((type: AuthType = "user") => {
    const parsed: UserInfo | null = parseUserInfo(type);
    if (type === "admin") setAdmin(parsed);
    else setUser(parsed);
    return parsed;
  }, []);

  const refreshAuth = useCallback(
    async (type: AuthType = "user") => {
      // 동시 호출은 requestRefresh 내부에서 하나로 합쳐진다.
      const ok = await requestRefresh(type);

      // 실패했으면 쿠키를 지워서 로그인 상태를 확실히 해제한다.
      // (남겨두면 401 → refresh 실패를 계속 반복하게 된다)
      if (!ok) clearAuthCookies(type);

      const next = syncAuth(type);
      return ok ? next : null;
    },
    [syncAuth],
  );

  useEffect(() => {
    syncAuth("user");
    syncAuth("admin");
    setIsLoading(false);
  }, [syncAuth]);

  // useAPI에서 세션이 만료되면(refresh까지 실패) 쿠키가 지워진 상태로 이벤트가 온다.
  // 여기서 Context를 비워야 라우트 가드가 로그인 화면으로 보낼 수 있다.
  useEffect(() => {
    const handleExpired = (event: Event) => {
      const { type } = (event as CustomEvent<{ type: AuthType }>).detail ?? {};
      syncAuth(type ?? "user");
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, [syncAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        admin,
        isLoading,
        setUser,
        setAdmin,
        syncAuth,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
