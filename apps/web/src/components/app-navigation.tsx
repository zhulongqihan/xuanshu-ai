"use client";

import {
  BookOpenText,
  CalendarDays,
  ChartNoAxesCombined,
  CircleUserRound,
  Home,
  MessageCircleMore,
  Settings,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryItems = [
  { href: "/", label: "今日", icon: Home },
  { href: "/profiles", label: "档案", icon: CircleUserRound },
  { href: "/charts", label: "命盘", icon: ChartNoAxesCombined },
  { href: "/almanac", label: "择日", icon: CalendarDays },
  { href: "/liuyao", label: "问事", icon: Sparkles },
  { href: "/consult", label: "咨询", icon: MessageCircleMore },
];

const secondaryItems = [
  { href: "/sources", label: "规则与来源", icon: BookOpenText },
  { href: "/settings", label: "设置", icon: Settings },
];

function NavLink({
  href,
  label,
  icon: Icon,
  compact = false,
}: (typeof primaryItems)[number] & { compact?: boolean }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      className={compact ? "mobile-nav-link" : "sidebar-link"}
      data-active={active}
      href={href}
      aria-current={active ? "page" : undefined}
    >
      <Icon aria-hidden="true" size={compact ? 20 : 18} strokeWidth={1.8} />
      <span>{label}</span>
    </Link>
  );
}

export function AppNavigation() {
  return (
    <>
      <aside className="sidebar" aria-label="主导航">
        <Link className="brand" href="/" aria-label="玄枢 AI 今日工作台">
          <span className="brand-mark" aria-hidden="true">
            玄
          </span>
          <span className="brand-name">玄枢 AI</span>
        </Link>

        <nav className="sidebar-nav">
          <div className="sidebar-group">
            {primaryItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
          <div className="sidebar-group sidebar-group-secondary">
            {secondaryItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </nav>

        <div className="local-status">
          <span className="status-dot" aria-hidden="true" />
          <span>
            <strong>本地模式</strong>
            <small>数据仅存此设备</small>
          </span>
        </div>
      </aside>

      <nav className="mobile-nav" aria-label="移动端主导航">
        {primaryItems.slice(0, 3).map((item) => (
          <NavLink key={item.href} {...item} compact />
        ))}
        <NavLink {...primaryItems[4]} compact />
        <NavLink {...primaryItems[5]} compact />
      </nav>
    </>
  );
}
