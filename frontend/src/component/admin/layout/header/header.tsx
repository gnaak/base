import { type LucideIcon } from "lucide-react";
import { useLocation } from "react-router-dom";

interface AdminHeaderProps {
  getHeaderInfoByPath: (path: string) => {
    label: string;
    icon: LucideIcon | null;
  };
}

const AdminHeader = ({ getHeaderInfoByPath }: AdminHeaderProps) => {
  const { pathname } = useLocation();
  const { label, icon: Icon } = getHeaderInfoByPath(pathname);

  return (
    <header className="flex h-16 items-center gap-3 px-8 border-b shrink-0 bg-white">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-[linear-gradient(to_bottom_right,#CACACA_0%,#FFFFFF_79%)]">
        {Icon ? (
          <Icon className="h-4 w-4 text-gray-600" />
        ) : (
          <div className="h-1 w-1 rounded-full bg-gray-400" />
        )}
      </div>
      <span className="font-bold">{label}</span>
    </header>
  );
};

export default AdminHeader;
