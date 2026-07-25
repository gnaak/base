import { refreshExp } from "@/hooks/common/getCookie";
import { useAuth } from "@/hooks/common/useAuth";
import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import AdminSidebar from "@/component/admin/layout/sideBar/sideBar";
import { AdminMenuItem } from "@/types/admin/sidebar";
import { LucideIcon } from "lucide-react";
import AdminHeader from "@/component/admin/layout/header/header";
import {
  ChartColumnIcon,
  UsersIcon,
} from "lucide-react";

const adminMenu: AdminMenuItem[] = [
  {
    type: "link",
    label: "대시보드",
    to: "/admin",
    icon: ChartColumnIcon,
  },
  {
    type: "group",
    title: "그룹 관리",
    icon: UsersIcon,
    children: [
      {
        label: "고객사별 통계",
        to: "/admin/group",
        icon: UsersIcon,
      },
    ],
  },
];

const routeConfig: Record<
  string,
  { label: string; icon: LucideIcon | undefined }
> = adminMenu.reduce(
  (acc, item) => {
    if (item.type === "link") {
      acc[item.to] = { label: item.label, icon: item.icon };
    } else {
      item.children.forEach((child) => {
        acc[child.to] = { label: child.label, icon: child.icon };
      });
    }
    return acc;
  },
  {} as Record<string, { label: string; icon: LucideIcon | undefined }>,
);

const getHeaderInfoByPath = (pathname: string) => {
  const key = Object.keys(routeConfig)
    .sort((a, b) => b.length - a.length)
    .find((k) => pathname === k || pathname.startsWith(k + "/"));

  return (
    (key && routeConfig[key]) || {
      label: "관리자 도구",
      icon: null,
    }
  );
};

const AdminLayout = () => {
  const { admin, isLoading, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // refresh는 1회만 시도한다 (실패 후 effect가 다시 돌아 무한 호출되는 것 방지)
  const refreshTried = useRef(false);

  const isAdmin = admin?.auth_type === "admin";

  useEffect(() => {
    if (isLoading || isAdmin) return;

    // access 쿠키만 만료된 상태라면 refresh 후 Context를 갱신한다 (페이지 새로고침 없음)
    if (!refreshTried.current && refreshExp("admin")) {
      refreshTried.current = true;
      refreshAuth("admin").then((next) => {
        if (next?.auth_type !== "admin") {
          navigate("/admin/login", { replace: true });
        }
      });
      return;
    }

    navigate("/admin/login", { replace: true });
  }, [isLoading, isAdmin, navigate, refreshAuth]);

  if (isLoading || !isAdmin) {
    return null;
  }

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="flex h-screen w-full bg-adminMain text-textMain">
      <AdminSidebar
        collapsed={sidebarCollapsed}
        adminMenu={adminMenu}
        onToggleSidebar={handleToggleSidebar}
      />

      <main className="flex h-screen flex-1 flex-col min-w-0">
        <AdminHeader getHeaderInfoByPath={getHeaderInfoByPath} />
        <section className="relative flex-1 p-4 py-6 min-h-0">
          <div className="w-full h-full min-h-0 overflow-y-auto scrollbar-hide">
            <Outlet />
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminLayout;
