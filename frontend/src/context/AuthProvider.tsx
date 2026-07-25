// src/context/AuthProvider.tsx

import { useCallback, useEffect, useRef, useState, ReactNode } from "react";
import { parseUserInfo } from "@/hooks/common/getCookie";
import { requestRefresh } from "@/hooks/common/useAPI";
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

  // 동일 타입의 refresh 요청이 동시에 여러 번 날아가지 않도록 진행 중인 Promise를 공유한다.
  const pendingRef = useRef<Partial<Record<AuthType, Promise<UserInfo | null>>>>(
    {},
  );

  const syncAuth = useCallback((type: AuthType = "user") => {
    const parsed: UserInfo | null = parseUserInfo(type);
    if (type === "admin") setAdmin(parsed);
    else setUser(parsed);
    return parsed;
  }, []);

  const refreshAuth = useCallback(
    (type: AuthType = "user") => {
      const pending = pendingRef.current[type];
      if (pending) return pending;

      const task = requestRefresh(type)
        .catch(() => false)
        .then((ok) => {
          // 성공/실패와 무관하게 현재 쿠키 기준으로 상태를 맞춘다.
          const next = syncAuth(type);
          return ok ? next : null;
        })
        .finally(() => {
          delete pendingRef.current[type];
        });

      pendingRef.current[type] = task;
      return task;
    },
    [syncAuth],
  );

  useEffect(() => {
    syncAuth("user");
    syncAuth("admin");
    setIsLoading(false);
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
