import { Outlet } from "react-router-dom";
import { ChartColumnIcon } from "lucide-react";

import AdminSidebar from "@/component/admin/layout/sideBar/sideBar";
import { type AdminMenuItem } from "@/types/admin/sidebar";

/**
 * 관리자 메뉴 — **프로젝트마다 교체하는 자리다.**
 *
 * 단일 링크와 접히는 그룹 두 가지를 쓸 수 있다:
 *
 *   { type: "link",  label: "회원 목록", to: "/admin/users", icon: UsersIcon }
 *   { type: "group", title: "회원 관리", icon: UsersIcon, children: [
 *       { label: "전체", to: "/admin/users", icon: UsersIcon },
 *       { label: "탈퇴", to: "/admin/users/left", icon: UsersIcon },
 *   ]}
 *
 * `end: true` 는 정확히 그 경로일 때만 활성 표시한다 — `/admin` 처럼
 * 하위 경로를 여럿 가진 링크에 필요하다 (없으면 항상 활성으로 보인다).
 */
const adminMenu: AdminMenuItem[] = [
  {
    type: "link",
    label: "대시보드",
    to: "/admin",
    icon: ChartColumnIcon,
    end: true,
  },
];

/**
 * 관리자 레이아웃. **인증은 여기서 다루지 않는다.**
 *
 * 로그인 가드는 `App.tsx` 에서 이 컴포넌트를 감싸는 `<PrivateRoute authType="admin">`
 * 이 전담한다. 예전에는 같은 로직이 여기에도 인라인으로 있어서 두 곳을 같이 고쳐야 했다.
 *
 * `h-svh` 를 쓰는 이유 — 모바일 브라우저의 주소창이 접히고 펴질 때 `100vh` 는
 * 화면 밖으로 삐져나간다.
 */
const AdminLayout = () => {
  return (
    <div className="flex h-svh overflow-hidden bg-bg text-text-main">
      <AdminSidebar adminMenu={adminMenu} />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
