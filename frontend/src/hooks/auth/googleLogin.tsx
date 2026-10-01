import google from "@/assets/client/login/google.svg";
import { beginOAuth } from "./oauthState";

interface GoogleLoginBtnProps {
  client_id?: string;
  redirect_uri?: string;
  scopeParam?: string;
  className?: string;
}

const client_id_env = import.meta.env.VITE_APP_PUBLIC_GOOGLE_CLIENT_ID;
const redirect_uri_env = import.meta.env.VITE_APP_PUBLIC_GOOGLE_REDIRECT_URI;

const GoogleLoginBtn = ({
  client_id = client_id_env,
  redirect_uri = redirect_uri_env,
  scopeParam = "openid email profile",
  className = "",
}: GoogleLoginBtnProps) => {
  const handleClick = () => {
    // 로그인 뒤 돌아갈 곳. state 에 싣지 않고 sessionStorage 에 둔다 (oauthState.ts)
    const next = new URLSearchParams(window.location.search).get("next");
    const params = new URLSearchParams({
      client_id,
      redirect_uri,
      response_type: "code",
      access_type: "offline",
      state: beginOAuth("google", next),
      ...(scopeParam ? { scope: scopeParam } : {}),
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  return (
    <button
      className={`w-full py-3.5 rounded-xl border border-google-border bg-google hover:bg-google-hover active:scale-[0.98] transition-all flex items-center justify-center gap-3 ${className}`}
      onClick={handleClick}
    >
      <img src={google} alt="google login" className="w-5 h-5" />
      <span className="text-sm font-semibold text-google-text">Google로 계속하기</span>
    </button>
  );
};

export default GoogleLoginBtn;