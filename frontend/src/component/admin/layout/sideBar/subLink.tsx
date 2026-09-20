import { NavLink } from "react-router-dom";
import { type SubLinkProps } from "@/types/admin/sidebar";

const SubLink = ({ to, label, icon: Icon, end = false }: SubLinkProps) => {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          "group flex items-center gap-2.5 h-9 px-3 rounded-full",
          "text-[13px] font-medium transition-colors duration-150",
          isActive
            ? "bg-bg-hover text-text-main"
            : "text-text-sub hover:text-text-main hover:bg-bg-hover",
        ].join(" ")
      }
    >
      {Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
      <span className="truncate">{label}</span>
    </NavLink>
  );
};

export default SubLink;
