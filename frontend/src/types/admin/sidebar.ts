import { type LucideIcon } from "lucide-react";

interface BaseLinkItem {
  label: string;
  to: string;
  icon?: LucideIcon;
  number?: number;
  end?: boolean;
}

interface AdminLinkItem extends BaseLinkItem {
  type: "link";
}

interface AdminGroupItem {
  type: "group";
  title: string;
  icon?: LucideIcon;
  children: BaseLinkItem[];
}

export type AdminMenuItem = AdminLinkItem | AdminGroupItem;

export interface SubLinkProps extends BaseLinkItem {
  nested?: boolean;
  collapsed?: boolean;
}

interface GroupItemProps {
  title: string;
  children: BaseLinkItem[];
  icon?: LucideIcon;
}

export interface GroupProps {
  item: GroupItemProps;
  collapsed?: boolean;
}

// ======================================
// 페이지 별 Props
export interface AdminSidebarProps {
  adminMenu: AdminMenuItem[];
  /** md 미만에서 드로어로 열 때. 없으면 md 이상에서만 보이는 고정 사이드바다 */
  mobile?: boolean;
  onClose?: () => void;
}

export interface AdminHeaderProps {
  getTitleByPath: (pathname: string) => string;
}
