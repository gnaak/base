import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { type GroupProps } from "@/types/admin/sidebar";
import SubLink from "./subLink";

const GroupLink = ({ item }: GroupProps) => {
  const [open, setOpen] = useState(true);
  const Icon = item?.icon;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="
          flex items-center gap-2.5 h-9 px-3 rounded-full
          text-[12px] font-medium uppercase tracking-tight
          text-text-sub hover:text-text-main hover:bg-bg-hover
          transition-colors duration-150
        "
      >
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        <span className="flex-1 text-left truncate">{item.title}</span>
        <ChevronDownIcon
          className={[
            "w-3 h-3 shrink-0 transition-transform duration-150",
            open ? "rotate-0" : "-rotate-90",
          ].join(" ")}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-1.5 pl-2">
          {item.children.map((link) => (
            <SubLink key={link.to} {...link} />
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupLink;
