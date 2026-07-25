import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePost } from "@/hooks/common/useAPI";
import { refreshExp } from "@/hooks/common/getCookie";
import { useAuth } from "@/hooks/common/useAuth";
import { LoginRequest, LoginResponse } from "@/types/admin/login";
import LoginVisual from "@/component/admin/layout/login/loginVisual";
import LoginForm from "@/component/admin/layout/login/loginForm";
import LoginErrorModal from "@/component/admin/modal/loginErrorModal";

const LoginPage = () => {
  const navigate = useNavigate();
  const { admin, isLoading, syncAuth, refreshAuth } = useAuth();
  // 이미 남아 있는 세션에 대한 refresh는 1회만 시도한다
  const refreshTried = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errorModal, setErrorModal] = useState(false);

  const loginMutation = usePost<LoginRequest, LoginResponse>("api/auth/login");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { email, password, type: "admin" },
      {
        onSuccess: () => {
          // 로그인 응답으로 새로 내려온 쿠키를 Context에 반영한 뒤 이동
          syncAuth("admin");
          navigate("/admin", { replace: true });
        },
        onError: () => {
          setErrorModal(true);
        },
      }
    );
  };

  useEffect(() => {
    if (isLoading) return;

    if (admin?.auth_type === "admin") {
      navigate("/admin", { replace: true });
      return;
    }

    // 세션이 남아 있으면 조용히 갱신해서 로그인 화면을 건너뛴다
    if (!refreshTried.current && refreshExp("admin")) {
      refreshTried.current = true;
      refreshAuth("admin");
    }
  }, [admin, isLoading, navigate, refreshAuth]);

  return (
    <div className="min-h-screen bg-[#FDFDFE] flex font-sans overflow-hidden text-main">
      <LoginVisual />
      <LoginForm
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        showPw={showPw}
        setShowPw={setShowPw}
        onSubmit={onSubmit}
      />

      <LoginErrorModal open={errorModal} onClose={() => setErrorModal(false)} />
    </div>
  );
};

export default LoginPage;