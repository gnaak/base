import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, X } from "lucide-react";
import GroupLink from "./groupLink";
import SubLink from "./subLink";
import { usePost } from "@/hooks/common/useAPI";
import { type AdminSidebarProps } from "@/types/admin/sidebar";
import { useAuth } from "@/hooks/common/useAuth";
import ConfirmModal from "@/component/admin/ui/feedback/confirmModal";

const AdminSidebar = ({ adminMenu, mobile = false, onClose }: AdminSidebarProps) => {
  const navigate = useNavigate();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const logoutMutation = usePost<void, void>("api/auth/logout_admin");
  const { admin, setAdmin } = useAuth();
  const name = admin?.user_nickname || "관리자";
  const initial = name.trim().charAt(0).toUpperCase();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setAdmin(null);
        navigate("/admin/login", { replace: true });
      },
    });
  };

  return (
    <aside
      className={
        mobile
          ? "relative flex flex-col w-60 max-w-[85vw] h-full bg-bg shadow-card animate-drawer-in"
          : "hidden md:flex flex-col w-60 shrink-0 h-svh sticky top-0 border-r border-line bg-bg"
      }
    >
      <div className="px-5 h-14 shrink-0 flex items-center justify-between border-b border-line">
        <span className="font-mono text-[13px] font-medium tracking-tight text-text-main">
          base · admin
        </span>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            aria-label="메뉴 닫기"
            className="inline-flex items-center justify-center w-8 h-8 -mr-2 rounded-full text-text-sub hover:text-text-main hover:bg-bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-1.5 px-2 py-3 overflow-y-auto">
        {adminMenu.map((item, idx) =>
          item.type === "link" ? (
            <SubLink key={`${item.to}-${idx}`} {...item} />
          ) : (
            <GroupLink key={`${item.title}-${idx}`} item={item} />
          ),
        )}
      </nav>

      <div className="mt-auto px-3 py-3 border-t border-line">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-bg-sub shadow-border flex items-center justify-center text-[11px] font-medium text-text-sub shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-text-main truncate">
              {name}
            </div>
            <div className="text-[11px] text-text-sub truncate">관리자</div>
          </div>
          <button
            type="button"
            onClick={() => setLogoutModalOpen(true)}
            aria-label="로그아웃"
            title="로그아웃"
            className="
              shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full
              text-text-sub hover:text-text-main
              hover:bg-bg-hover active:bg-bg-active
              transition-colors duration-150
            "
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ConfirmModal
        open={logoutModalOpen}
        onCancel={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
        title="로그아웃 하시겠습니까?"
        description={
          <>
            현재 세션이 종료됩니다.
            <br />
            콘솔에 다시 접근하려면 로그인해야 합니다.
          </>
        }
        variant="danger"
        icon={<LogOut />}
        size="sm"
        confirmLabel="로그아웃"
        cancelLabel="취소"
      />
    </aside>
  );
};

export default AdminSidebar;
