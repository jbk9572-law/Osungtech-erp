"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { getVisibleMenuGroups } from "@/lib/erp-menu";

type LeafItem = { label: string; href?: string };
type GroupItem = { label: string; items: LeafItem[] };

// 그룹당 아이콘 하나 — 사이드바를 접었을 때는 이 아이콘이 그 메뉴를
// 구분하는 유일한 단서라서(라벨 텍스트가 안 보임), 목록에 없는
// 그룹이어도 화면이 깨지지 않게 GROUP_ICONS[label]가 undefined면
// 그냥 아이콘 없이 렌더링한다.
const ICON_STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

// 재미나이 제안으로 처음 아이콘을 만들었을 때 좌표를 손대충(12.6, 3.2,
// .5.5 같은 임의의 소수점) 잡아서 "AI가 그린 티가 난다"는 피드백을
// 받았다 — 정수/반정수 좌표로만 다시 그려서 훨씬 정돈된 느낌으로
// 바꿨다(페더/루사이드 같은 실제 아이콘셋이 쓰는 격자 방식과 동일).
const GROUP_ICONS: Record<string, ReactNode> = {
  "메인 대시보드": (
    <svg {...ICON_STROKE}>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  ),
  매출관리: (
    <svg {...ICON_STROKE}>
      <path d="M6 16 16 6" />
      <path d="M9 6h7v7" />
    </svg>
  ),
  매입관리: (
    <svg {...ICON_STROKE}>
      <path d="M16 6 6 16" />
      <path d="M6 9v7h7" />
    </svg>
  ),
  재고관리: (
    <svg {...ICON_STROKE}>
      <path d="M12 3 4 7v10l8 4 8-4V7z" />
      <path d="M4 7l8 4 8-4" />
      <path d="M12 11v10" />
    </svg>
  ),
  품목관리: (
    <svg {...ICON_STROKE}>
      <path d="M4 5h9l7 7-9 9-7-7z" />
      <circle cx="8" cy="9" r="1.5" />
    </svg>
  ),
  생산관리: (
    <svg {...ICON_STROKE}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2" />
    </svg>
  ),
  거래처관리: (
    <svg {...ICON_STROKE}>
      <circle cx="9" cy="9" r="3" />
      <path d="M4 19c1-3 3-5 5-5s4 2 5 5" />
      <circle cx="18" cy="10" r="2.3" />
      <path d="M15 14c2 0 4 2 5 5" />
    </svg>
  ),
  할일관리: (
    <svg {...ICON_STROKE}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8 13 3 3 5-6" />
    </svg>
  ),
  전자결재: (
    <svg {...ICON_STROKE}>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M15 3v3h3" />
      <path d="m9 13 2 2 4-5" />
    </svg>
  ),
  공지사항: (
    <svg {...ICON_STROKE}>
      <path d="M12 3a5 5 0 0 0-5 5v3l-2 5h14l-2-5V8a5 5 0 0 0-5-5z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  ),
  "회계·보고서": (
    <svg {...ICON_STROKE}>
      <path d="M5 20V10" />
      <path d="M11 20V4" />
      <path d="M17 20v-7" />
      <path d="M3 20h18" />
    </svg>
  ),
  확장모듈: (
    <svg {...ICON_STROKE}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  ),
  환경설정: (
    <svg {...ICON_STROKE}>
      <path d="M4 7h16" />
      <circle cx="16" cy="7" r="2" />
      <path d="M4 12h16" />
      <circle cx="10" cy="12" r="2" />
      <path d="M4 17h16" />
      <circle cx="16" cy="17" r="2" />
    </svg>
  ),
  시스템관리: (
    <svg {...ICON_STROKE}>
      <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z" />
      <path d="m9 12 2 2 4-5" />
    </svg>
  ),
};

export function TreeMenu({
  usageWidget,
  collapsed,
  isMobile,
  onToggleCollapsed,
  disabledFeatures,
}: {
  // DB/스토리지/서버 사용량 위젯은 서버 컴포넌트(usage-widget-panel.tsx)가
  // 별도로 조회해서 미리 렌더링해 넘겨준다 — 레이아웃의 다른 데이터와
  // 묶어 이 클라이언트 컴포넌트 안에서 직접 조회/렌더링하면, 그 조회가
  // 느려지거나 실패할 때 트리메뉴 전체가 같이 멈춰 보인다(로딩 중 위젯이
  // 깨져 보이던 원인). collapsed 상태에 따라 보이기만/숨기기만 여기서
  // 결정한다.
  usageWidget: ReactNode;
  collapsed: boolean;
  isMobile: boolean;
  onToggleCollapsed: () => void;
  // 이 테넌트(회사)가 꺼둔 기능 그룹(설정 > 기능 관리, migration 104).
  // 예전엔 여기서 erp-menu.ts의 MENU_GROUPS를 통째로 그대로 썼는데,
  // SaaS 판매용 전환으로 회사마다 켜는 메뉴가 달라져야 해서 서버가
  // 내려준 이 값으로 걸러낸 목록만 쓴다.
  disabledFeatures: string[];
}) {
  const pathname = usePathname();
  const TREE: GroupItem[] = getVisibleMenuGroups(disabledFeatures);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of TREE) {
      initial[group.label] = group.items.some(
        (i) => i.href && pathname.startsWith(i.href),
      );
    }
    return initial;
  });

  return (
    <>
      {isMobile && !collapsed && (
        <div className="erp-tree-backdrop" onClick={onToggleCollapsed} />
      )}
      <nav className={`erp-tree${collapsed ? " collapsed" : ""}`}>
        <div className="erp-tree-scroll">
          <button
            type="button"
            className="erp-tree-toggle"
            onClick={onToggleCollapsed}
            title={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          >
            {collapsed ? "»" : "« 메뉴 접기"}
          </button>

          {TREE.map((group) => {
            const hasLinks = group.items.some((i) => i.href);
            const isOpen = openGroups[group.label];
            return (
              <div className="erp-tree-group" key={group.label}>
                <button
                  type="button"
                  className={`erp-tree-group-label${hasLinks ? "" : " disabled"}`}
                  title={collapsed ? group.label : undefined}
                  onClick={() =>
                    setOpenGroups((prev) => ({
                      ...prev,
                      [group.label]: !prev[group.label],
                    }))
                  }
                >
                  {!collapsed && (
                    <span className="erp-tree-caret">{isOpen ? "▾" : "▸"}</span>
                  )}
                  {GROUP_ICONS[group.label] && (
                    <span className="erp-tree-icon">{GROUP_ICONS[group.label]}</span>
                  )}
                  {!collapsed && <span>{group.label}</span>}
                </button>
                {isOpen && !collapsed && (
                  <div className="erp-tree-children">
                    {group.items.map((item) => {
                      if (!item.href) {
                        return (
                          <span
                            className="erp-tree-item disabled"
                            key={item.label}
                          >
                            {item.label}
                            <span className="erp-tree-badge">준비중</span>
                          </span>
                        );
                      }
                      const active = pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          className={`erp-tree-item${active ? " active" : ""}`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!collapsed && usageWidget}
      </nav>
    </>
  );
}
