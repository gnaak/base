import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePost } from "../common/useAPI";
import { useAuth } from "../common/useAuth";
import { consumeOAuthState } from "./oauthState";

interface KakaoProps {
  onSuccess?: (data) => void;
  onError?: (error) => void;
  autoRun?: boolean;
  redirectURL: string;
  apiURL: string;
}

/**
 * Kakao OAuth2 로그인 콜백 처리 컴포넌트
 *
 * URL 쿼리 파라미터의 `code` 값을 읽어 Kakao 인증을 처리하고,
 * 지정된 API 엔드포인트(`apiURL`)로 로그인 요청을 보낸 뒤
 * 성공 시 `redirectURL`로 이동합니다.
 *
 * @param onSuccess 로그인 성공 시 호출되는 콜백 (API 응답 데이터 전달)
 * @param onError 로그인 실패 시 호출되는 콜백 (에러 객체 전달)
 * @param autoRun 컴포넌트 마운트 시 자동 실행 여부 (기본값: true)
 * @param redirectURL 로그인 성공 후 이동할 경로
 * @param apiURL 카카오 로그인 API endpoint (예: "/auth/kakao")
 *
 * @example
 * <KakaoCallBack
 *   apiURL="auth/kakao"
 *   redirectURL="/dashboard"
 *   onSuccess={(data) => console.log("로그인 성공:", data)}
 *   onError={(err) => console.error("로그인 실패:", err)}
 * />
 */
const KakaoCallBack = ({
  onSuccess,
  onError,
  autoRun = true,
  redirectURL,
  apiURL,
}: KakaoProps) => {
  const navigate = useNavigate();
  const { syncAuth } = useAuth();
  const searchParams = new URL(document.location.toString()).searchParams;
  const code = searchParams.get("code");
  const device_info = navigator.userAgent;

  const kakaoLogin = usePost(apiURL);
  const kakaoLoginAction = async () => {
    if (!code) return;
    // 로그인 버튼이 만든 state 와 같을 때만 code 를 보낸다 — 아니면 남이 만든 콜백 링크다 (로그인 CSRF)
    const state = consumeOAuthState("kakao", searchParams.get("state"));
    if (!state.ok) {
      onError?.({ status: 400, message: "로그인을 다시 시작해 주세요 (state 불일치)" });
      return;
    }
    try {
      const data = await kakaoLogin.mutateAsync({ code, device_info });
      // 로그인 응답으로 내려온 쿠키를 Context에 반영
      syncAuth();
      onSuccess?.(data);
      navigate(state.next || redirectURL, { replace: true });
    } catch (err) {
      onError?.(err);
    }
  };

  // state 는 한 번만 쓸 수 있다 — StrictMode 처럼 effect 가 두 번 돌면 두 번째가 "불일치"로 실패한다
  const ran = useRef(false);

  useEffect(() => {
    if (!autoRun || ran.current) return;
    ran.current = true;
    kakaoLoginAction();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return null;
};

export default KakaoCallBack;
