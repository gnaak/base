import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { baseURL } from "@/hooks/common/useAPI";
import { useAuth } from "@/hooks/common/useAuth";

interface GoogleCallbackProps {
  apiURL: string;
  redirectURL: string;
  onSuccess: () => void;
  onError: (error: { status?: number; message?: string }) => void;
}

const GoogleCallback = ({ apiURL, redirectURL, onSuccess, onError }: GoogleCallbackProps) => {
  const navigate = useNavigate();
  const { syncAuth } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const rawState = params.get("state");

    if (!code) {
      onError({ message: "code 없음" });
      return;
    }

    let stateObj: { next?: string; isPopup?: boolean } = {};
    try {
      if (rawState) stateObj = JSON.parse(decodeURIComponent(rawState));
    } catch {
      // state가 없거나 깨진 경우 기본값으로 진행
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

        if (stateObj.isPopup && window.opener) {
          window.opener.postMessage({ type: "GOOGLE_LOGIN_SUCCESS", next: stateObj.next }, window.location.origin);
          window.close();
        } else {
          // 로그인 응답으로 내려온 쿠키를 Context에 반영 (새로고침 없이 user 상태 갱신)
          syncAuth();
          onSuccess();
          navigate(stateObj.next || redirectURL, { replace: true });
        }
      } catch {
        onError({ message: "네트워크 오류" });
      }
    };

    exchange();
  }, []);

  return null;
};

export default GoogleCallback;
