import { Link } from "react-router-dom";
import { ArrowRight, LayoutDashboard, LogOut, MoonStar, ShieldCheck } from "lucide-react";

import GoogleLoginBtn from "@/hooks/auth/googleLogin";
import KakaoLoginBtn from "@/hooks/auth/kakaoLogin";
import { usePost } from "@/hooks/common/useAPI";
import { useAuth } from "@/hooks/common/useAuth";
import ThemeToggle from "@/component/common/themeToggle";

/**
 * 고객 첫 화면 — **프로젝트마다 교체하는 자리다.** (`/plan` 의 phase 1 이 서비스 화면으로 바꾼다)
 *
 * 템플릿 상태에서도 볼 만하게: 왼쪽 소개 · 오른쪽 로그인 카드, 좁은 화면에선 위아래로 쌓인다.
 * 색은 전부 토큰이라 다크모드와 고객 화면 테마(`.theme-client[data-theme]`)가 그대로 먹는다.
 */

const FEATURES = [
  {
    Icon: ShieldCheck,
    title: "소셜 로그인",
    desc: "구글·카카오 계정으로 바로 시작해요. 세션은 httponly 쿠키에만 담겨요.",
  },
  {
    Icon: LayoutDashboard,
    title: "관리자 콘솔",
    desc: "대시보드·표·폼·모달 컴포넌트가 /admin 에 준비돼 있어요.",
  },
  {
    Icon: MoonStar,
    title: "다크모드",
    desc: "처음엔 기기 설정을 따라가고, 우측 상단에서 직접 고를 수 있어요.",
  },
];

const ClientMain = () => {
  const { user, setUser } = useAuth();
  const logoutMutation = usePost<void, void>("api/auth/logout");

  const handleLogout = () => {
    logoutMutation.mutate(undefined, { onSuccess: () => setUser(null) });
  };

  const name = user?.user_nickname || "회원";

  return (
    <div className="relative isolate min-h-svh flex flex-col bg-bg text-text-main">
      {/* 배경 그라데이션 + 그리드 — 관리자 로그인과 같은 무늬 */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgb(var(--text-main)/0.05),_transparent_60%)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(rgb(var(--text-main)/0.03)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--text-main)/0.03)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      </div>

      <header className="mx-auto w-full max-w-6xl h-16 px-5 md:px-8 flex items-center justify-between">
        <span className="font-mono text-[14px] font-semibold tracking-tight">base</span>
        <ThemeToggle />
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-5 md:px-8 py-10 md:py-16 grid gap-12 md:grid-cols-[1fr_380px] md:items-center">
        {/* 소개 */}
        <section className="flex flex-col gap-8">
          <span className="self-start inline-flex items-center gap-2 rounded-full bg-bg-card shadow-border px-3 py-1 text-[12px] text-text-sub">
            <span className="w-1.5 h-1.5 rounded-full bg-point-green" />
            zero-to-one 템플릿
          </span>

          <div className="flex flex-col gap-4">
            <h1 className="text-[36px] md:text-[52px] leading-[1.1] font-semibold tracking-display">
              아이디어에서 서비스까지,
              <br />
              로그인부터 준비돼 있어요
            </h1>
            <p className="max-w-[520px] text-[15px] md:text-[16px] leading-relaxed text-text-sub">
              이 화면은 템플릿의 첫 페이지예요. 기획을 마치면 서비스에 맞는 화면으로 바뀌어요.
            </p>
          </div>

          <ul className="flex flex-col gap-4 max-w-[520px]">
            {FEATURES.map(({ Icon, title, desc }) => (
              <li key={title} className="flex gap-3">
                <span className="shrink-0 w-9 h-9 rounded-comfy bg-bg-card shadow-border flex items-center justify-center text-text-sub">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <span className="text-[14px] font-medium tracking-tight">{title}</span>
                  <span className="text-[13px] leading-relaxed text-text-sub">{desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 로그인 카드 */}
        <section className="w-full max-w-[420px] md:max-w-none mx-auto rounded-2xl bg-bg-card shadow-card p-7">
          {user ? (
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-bg-sub shadow-border flex items-center justify-center text-[18px] font-semibold text-text-sub">
                {name.trim().charAt(0).toUpperCase()}
              </div>
              <h2 className="mt-4 text-[18px] font-semibold tracking-tight">{name}님, 반가워요</h2>
              <p className="mt-1 text-[13px] text-text-sub">로그인된 상태예요.</p>
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                className="
                  mt-6 w-full h-11 rounded-xl inline-flex items-center justify-center gap-2
                  text-[14px] font-medium text-text-main
                  bg-bg-card shadow-border hover:bg-bg-hover active:bg-bg-active
                  disabled:opacity-60 transition-colors
                "
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              <h2 className="text-[18px] font-semibold tracking-tight">시작하기</h2>
              <p className="mt-1 text-[13px] text-text-sub">쓰던 계정으로 바로 계속하세요.</p>
              <div className="mt-6 flex flex-col gap-3">
                <GoogleLoginBtn />
                <KakaoLoginBtn />
              </div>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-line flex justify-center">
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-1 text-[12px] text-text-sub hover:text-text-main transition-colors"
            >
              관리자 로그인
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-5 md:px-8 py-6 text-[12px] text-text-disabled">
        © {new Date().getFullYear()} base
      </footer>
    </div>
  );
};

export default ClientMain;
