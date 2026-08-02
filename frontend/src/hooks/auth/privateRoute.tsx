import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { refreshExp } from "@/hooks/common/getCookie";
import { useAuth } from "@/hooks/common/useAuth";
import type { AuthType } from "@/types/auth";

interface PrivateRouteProps {
  children: React.ReactNode;
  /** 요구할 세션 종류. 기본 "user" */
  authType?: AuthType;
  /** 세션이 없을 때 보낼 경로. 기본은 authType에 따라 "/" 또는 "/admin/login" */
  redirectTo?: string;
}

/**
 * 로그인이 필요한 라우트를 감싼다. `PublicRoute`의 반대편.
 *
 * 동작 순서:
 * 1. Context에 세션이 있으면 그대로 통과
 * 2. 없지만 `refresh_exp` 마커가 살아있으면 → refresh를 **1회만** 시도하고 그동안 fallback 표시
 * 3. 그래도 없으면 로그인 화면으로 이동
 *
 * ⚠️ 여기서 페이지를 새로고침하지 않는다. 쿠키가 남은 채 리로드하면 무한 루프가 된다.
 *
 * @example
 * <Route element={<PrivateRoute><MyPage /></PrivateRoute>} path="/mypage" />
 * <Route element={<PrivateRoute authType="admin"><AdminPage /></PrivateRoute>} path="/admin/x" />
 */
export const PrivateRoute = ({
  children,
  authType = "user",
  redirectTo,
}: PrivateRouteProps) => {
  const { user, admin, isLoading, refreshAuth } = useAuth();
  const location = useLocation();
  // refresh는 마운트당 1회. 실패 후 effect가 다시 돌아 무한 호출되는 것을 막는다.
  const refreshTried = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  const session = authType === "admin" ? admin : user;
  const hasSession = session?.auth_type === authType;

  // 아직 refresh를 시도해볼 여지가 있는지. 렌더 중에 판단해야
  // effect가 돌기 전에 Navigate로 튕겨나가지 않는다.
  const canRefresh = !hasSession && !refreshTried.current && refreshExp(authType);

  useEffect(() => {
    if (isLoading || hasSession) return;
    if (refreshTried.current || !refreshExp(authType)) return;

    refreshTried.current = true;
    setRefreshing(true);
    refreshAuth(authType).finally(() => setRefreshing(false));
  }, [isLoading, hasSession, authType, refreshAuth]);

  if (isLoading || refreshing || canRefresh) {
    return <div className="h-screen w-full bg-bg" />;
  }

  if (!hasSession) {
    const fallbackPath =
      redirectTo ?? (authType === "admin" ? "/admin/login" : "/");
    // 로그인 후 원래 가려던 곳으로 돌려보내고 싶으면 state.from을 읽어서 쓴다.
    return (
      <Navigate to={fallbackPath} replace state={{ from: location.pathname }} />
    );
  }

  return <>{children}</>;
};
