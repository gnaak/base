import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePost } from "@/hooks/common/useAPI";
import { parseUserInfo } from "@/hooks/common/getCookie";
import { useAuth } from "@/hooks/common/useAuth";
import { type LoginRequest, type LoginResponse } from "@/types/admin/login";
import LoginForm from "@/component/admin/layout/login/loginForm";
import LoginErrorModal from "@/component/admin/modal/loginErrorModal";

const LoginPage = () => {
  const navigate = useNavigate();
  const { setAdmin } = useAuth();
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errorModal, setErrorModal] = useState(false);

  const loginMutation = usePost<LoginRequest, LoginResponse>("api/auth/login");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { email: adminId, password, type: "admin" },
      {
        onSuccess: () => {
          setAdmin(parseUserInfo("admin"));
          navigate("/admin", { replace: true });
        },
        onError: () => {
          setErrorModal(true);
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-10 font-sans text-text-main">
      {/* 배경 그라데이션 + 그리드 */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgb(var(--text-main)/0.04),_transparent_60%)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(rgb(var(--text-main)/0.025)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--text-main)/0.025)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </div>

      <div className="w-full max-w-[380px] flex flex-col gap-7">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-bg-card ring-1 ring-line shadow-sm flex items-center justify-center overflow-hidden">
            <img src="/image.png" alt="base" className="w-7 h-7" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-[18px] font-semibold tracking-tight">
              관리자 로그인
            </h1>
            <p className="text-[13px] text-text-sub">
              관리자 콘솔
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-bg-card ring-1 ring-line shadow-sm p-7">
          <LoginForm
            adminId={adminId}
            setAdminId={setAdminId}
            password={password}
            setPassword={setPassword}
            showPw={showPw}
            setShowPw={setShowPw}
            onSubmit={onSubmit}
            isLoading={loginMutation.isPending}
          />
        </div>

        <p className="text-center text-[11px] text-text-disabled">
          허가된 관리자만 접근할 수 있습니다. · v1.0.0
        </p>
      </div>

      <LoginErrorModal open={errorModal} onClose={() => setErrorModal(false)} />
    </div>
  );
};

export default LoginPage;
