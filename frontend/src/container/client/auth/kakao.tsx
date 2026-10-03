import KakaoCallBack from "@/hooks/auth/kakaoCallback";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "@/component/client/ui/confirmModal";
import Spinner from "@/component/client/ui/spinner";

const Kakao = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDisabledOpen, setIsDisabledOpen] = useState<boolean>(false);

  const handleGoHome = () => navigate("/");

  return (
    <>
      <div className="w-screen h-screen flex flex-col items-center justify-center text-primary">
        {isLoading && <Spinner size="lg" label="로그인 중" />}
      </div>
      <ConfirmModal
        open={isDisabledOpen}
        icon={<AlertTriangle />}
        title="현재 계정이 비활성화 상태입니다."
        description={
          <span>
            로그인 권한이 필요하신 경우 관리자에게 문의해 주세요.
            <br />
            관리자 이메일 : example@email.com
          </span>
        }
        hideCancel
        onConfirm={handleGoHome}
        onCancel={handleGoHome}
      />
      <KakaoCallBack
        apiURL="api/auth/kakao"
        onSuccess={() => {}}
        redirectURL="/"
        onError={(error) => {
          setIsLoading(false);
          if (error.status == 403) setIsDisabledOpen(true);
        }}
      />
    </>
  );
};

export default Kakao;
