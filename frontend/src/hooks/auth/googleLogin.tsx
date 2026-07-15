import google from "@/assets/client/login/google.svg";

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
    const searchParams = new URLSearchParams(window.location.search);
    const next = searchParams.get("next");

    const stateObj = next ? { next, isPopup: true } : {};
    const state = encodeURIComponent(JSON.stringify(stateObj));
    const scopeQuery = scopeParam ? `&scope=${encodeURIComponent(scopeParam)}` : "";

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${client_id}&redirect_uri=${encodeURIComponent(
      redirect_uri
    )}&response_type=code&access_type=offline${scopeQuery}&state=${state}`;
  };

  return (
    <button
      className={`w-full py-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-3 ${className}`}
      onClick={handleClick}
    >
      <img src={google} alt="google login" className="w-5 h-5" />
      <span className="text-sm font-semibold text-slate-700">Google로 계속하기</span>
    </button>
  );
};

export default GoogleLoginBtn;