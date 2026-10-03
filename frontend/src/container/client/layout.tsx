import { useGet } from "@/hooks/common/useAPI";
import { UserDetail } from "@/types/user";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/common/useAuth";
import Spinner from "@/component/client/ui/spinner";

/**
 * 고객 레이아웃. 최상단 `.theme-client` 가 고객 화면 테마의 범위다 —
 * phase 1 "디자인 기반" 이 여기에 `data-theme="{기본 테마}"` 를 달고, index.css 의
 * `.theme-client[data-theme="x"]` 가 색·모양·글꼴 토큰을 덮어쓴다 (DESIGN.md "고객 화면").
 * 글자색·배경을 여기서 다시 잡는 이유: body 의 값은 :root 토큰으로 계산돼 내려와 테마가 닿지 않는다.
 */
const ClientLayOut = () => {
  const { user, isLoading } = useAuth();
  const { data: meData } = useGet<UserDetail>("api/user/me", ["me"], !!user);

  return (
    <div className="theme-client relative flex min-h-full flex-col bg-bg text-text-main">
      {isLoading ? (
        <div className="w-full h-[100svh] flex items-center justify-center text-primary">
          <Spinner size="lg" label="불러오는 중" />
        </div>
      ) : (
        <div className="flex w-full h-full flex-col">
          <Outlet context={{ user, meData }} />
        </div>
      )}
    </div>
  );
};
export default ClientLayOut;
