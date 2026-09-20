import { User, Lock, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import InputBox from "@/component/admin/ui/form/inputbox";

interface LoginFormProps {
  adminId: string;
  setAdminId: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  showPw: boolean;
  setShowPw: (val: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
}

const LoginForm = ({
  adminId,
  setAdminId,
  password,
  setPassword,
  showPw,
  setShowPw,
  onSubmit,
  isLoading = false,
}: LoginFormProps) => {
  const disabled = !adminId || !password || isLoading;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-medium text-neutral-600">
          관리자 ID
        </label>
        <InputBox
          type="text"
          value={adminId}
          placeholder="admin"
          onChange={(val) => setAdminId(val)}
          className="bg-neutral-50/60"
          leftIcon={<User className="w-4 h-4 text-neutral-400" />}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-medium text-neutral-600">
          비밀번호
        </label>
        <InputBox
          type={showPw ? "text" : "password"}
          value={password}
          placeholder="••••••••"
          onChange={(val) => setPassword(val)}
          className="bg-neutral-50/60"
          leftIcon={<Lock className="w-4 h-4 text-neutral-400" />}
          onRightIconClick={() => setShowPw(!showPw)}
          rightIcon={
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowPw(!showPw);
              }}
              className="flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors"
              aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 표시"}
            >
              {showPw ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
            </button>
          }
        />
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="
          mt-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl
          bg-neutral-900 text-white text-[13px] font-medium
          hover:bg-neutral-800 active:scale-[0.99]
          disabled:bg-neutral-300 disabled:cursor-not-allowed disabled:active:scale-100
          transition-all
        "
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            로그인 중...
          </>
        ) : (
          <>
            로그인
            <ArrowRight className="w-3.5 h-3.5" />
          </>
        )}
      </button>
    </form>
  );
};

export default LoginForm;
