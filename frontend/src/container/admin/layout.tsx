import { useState } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "@/component/admin/layout/sideBar/sideBar";
import { AdminMenuItem } from "@/types/admin/sidebar";
import { LucideIcon } from "lucide-react";
import AdminHeader from "@/component/admin/layout/header/header";
import { ChartColumnIcon } from "lucide-react";

// 프로젝트마다 교체하는 샘플 메뉴. 접히는 그룹 메뉴는 README "관리자 메뉴 추가" 참고.
const adminMenu: AdminMenuItem[] = [
  {
    type: "link",
    label: "대시보드",
    to: "/admin",
    icon: ChartColumnIcon,
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

/**
 * 관리자 레이아웃. **인증은 여기서 다루지 않는다.**
 *
 * 로그인 가드는 `App.tsx`에서 이 컴포넌트를 감싸는 `<PrivateRoute authType="admin">`이
 * 전담한다. 예전에는 같은 로직(refresh 1회 시도 → 실패 시 로그인 이동)이 여기에도
 * 인라인으로 있어서 두 곳을 같이 고쳐야 했다.
 */
const AdminLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
