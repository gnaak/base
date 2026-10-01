import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { baseURL } from "@/hooks/common/useAPI";
import { useAuth } from "@/hooks/common/useAuth";
import { consumeOAuthState } from "./oauthState";

interface GoogleCallbackProps {
  apiURL: string;
  redirectURL: string;
  onSuccess: () => void;
  onError: (error: { status?: number; message?: string }) => void;
}

const GoogleCallback = ({ apiURL, redirectURL, onSuccess, onError }: GoogleCallbackProps) => {
  const navigate = useNavigate();
  const { syncAuth } = useAuth();
  // state 는 한 번만 쓸 수 있다 — StrictMode 처럼 effect 가 두 번 돌면 두 번째가 "불일치"로 실패한다
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) {
      onError({ message: "code 없음" });
      return;
    }

    // 로그인 버튼이 만든 state 와 같을 때만 code 를 보낸다 — 아니면 남이 만든 콜백 링크다 (로그인 CSRF)
    const state = consumeOAuthState("google", params.get("state"));
    if (!state.ok) {
      onError({ status: 400, message: "로그인을 다시 시작해 주세요 (state 불일치)" });
      return;
    }

    const exchange = async () => {
      try {
        const response = await fetch(`${baseURL}/${apiURL}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          onError({ status: response.status });
          return;
        }

        // 로그인 응답으로 내려온 쿠키를 Context에 반영 (새로고침 없이 user 상태 갱신)
        syncAuth();
        onSuccess();
        navigate(state.next || redirectURL, { replace: true });
      } catch {
        onError({ message: "네트워크 오류" });
      }
    };

    exchange();
  }, []);

  return null;
};

export default GoogleCallback;
