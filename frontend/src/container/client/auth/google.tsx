import GoogleCallback from "@/hooks/auth/googleCallback";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Google = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [ismodal, setismodal] = useState<boolean>(false);
  const openmodal = () => {
    setismodal(true);
  };
  return (
    <>
      <div className="w-screen h-screen flex flex-col items-center justify-center">
        {isLoading && (
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mb-4"></div>
        )}
        {ismodal && (
          <>
            <div className="fixed inset-0 flex items-center justify-center z-[49] bg-overlay/60 backdrop-blur-sm">
              <div className="w-[300px] h-[220px] bg-bg-card py-5 border border-line rounded-2xl flex flex-col justify-around items-center">
                <div className="bg-bg-sub p-3 rounded-full">
                  <AlertTriangle className="text-text-sub" />
                </div>

                <div className="flex flex-col gap-1 items-center">
                  <span className="text-text-main text-[16px] font-medium">
                    현재 계정이 비활성화 상태입니다.
                  </span>
                  <div className="flex flex-col text-center">
                    <span className="text-text-sub text-xs">
                      로그인 권한이 필요하신 경우 관리자에게 문의해 주세요.
                    </span>
                    <span className="text-text-sub text-xs">
                      관리자 이메일 : example@email.com
                    </span>
                  </div>
                </div>

                <div className="flex flex-row w-full justify-center gap-2 font-medium text-sm">
                  <button
                    className="w-32 bg-primary text-text-inverse hover:bg-primary/90 rounded-xl py-2 px-4"
                    onClick={() => navigate("/")}
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <GoogleCallback
        apiURL="api/auth/google"
        onSuccess={() => {}}
        redirectURL="/"
        onError={(error) => {
          setIsLoading(false);
          if (error.status == 403) openmodal();
        }}
      />
    </>
  );
};

export default Google;
