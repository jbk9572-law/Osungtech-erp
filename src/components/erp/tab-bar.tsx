"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const SECTIONS: { prefix: string; label: string }[] = [
  { prefix: "/dashboard", label: "메인 대시보드" },
  { prefix: "/sales", label: "매출관리" },
  { prefix: "/purchases", label: "매입관리" },
  { prefix: "/inventory", label: "재고관리" },
  { prefix: "/products", label: "품목관리" },
  { prefix: "/customers", label: "판매처관리" },
  { prefix: "/suppliers", label: "공급처관리" },
  { prefix: "/paper-calc", label: "모조지 계산" },
  { prefix: "/settings", label: "환경설정" },
];

function sectionFor(pathname: string) {
  return SECTIONS.find((s) => pathname.startsWith(s.prefix));
}

type Tab = { label: string; href: string };

export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<Tab[]>([{ label: "메인 대시보드", href: "/dashboard" }]);

  useEffect(() => {
    const section = sectionFor(pathname);
    if (!section) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs open-tab list to the current route
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.label === section.label);
      if (idx === -1) return [...prev, { label: section.label, href: pathname }];
      if (prev[idx].href === pathname) return prev;
      const next = [...prev];
      next[idx] = { label: section.label, href: pathname };
      return next;
    });
  }, [pathname]);

  function closeTab(label: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((t) => t.label === label);
      const wasActive = sectionFor(pathname)?.label === label;
      const next = prev.filter((t) => t.label !== label);
      if (wasActive && next.length) {
        router.push(next[Math.max(0, idx - 1)].href);
      }
      return next;
    });
  }

  const currentLabel = sectionFor(pathname)?.label;

  return (
    <div className="erp-tabbar">
      {tabs.map((tab) => (
        <a
          key={tab.label}
          href={tab.href}
          onClick={(e) => {
            e.preventDefault();
            router.push(tab.href);
          }}
          className={`erp-tab${tab.label === currentLabel ? " active" : ""}`}
        >
          {tab.label}
          {tabs.length > 1 && (
            <span className="erp-tab-close" onClick={(e) => closeTab(tab.label, e)}>
              ×
            </span>
          )}
        </a>
      ))}
    </div>
  );
}
