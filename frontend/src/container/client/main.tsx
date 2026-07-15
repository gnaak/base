import GoogleLoginBtn from "@/hooks/auth/googleLogin";
import KakaoLoginBtn from "@/hooks/auth/kakaoLogin";

const ClientMain = () => {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200">
      <div className="w-full max-w-[380px] mx-4 rounded-2xl bg-white p-10 shadow-lg">
        <div className="text-center">
          <h1 className="text-xl font-bold text-main">project title</h1>
          <p className="mt-2 text-sm text-sub1/70">project summary will be shown here</p>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <GoogleLoginBtn />
          <KakaoLoginBtn />
        </div>
      </div>
    </div>
  );
};

export default ClientMain;