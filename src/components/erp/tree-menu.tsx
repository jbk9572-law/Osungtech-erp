"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  FREE_TIER_DB_LIMIT_BYTES,
  FREE_TIER_STORAGE_LIMIT_BYTES,
} from "@/lib/db-usage";
import type { VpsDiskUsage } from "@/lib/vps-usage";
import type { NetlifyUsageResult } from "@/lib/netlify-usage";
import { MENU_GROUPS } from "@/lib/erp-menu";

type LeafItem = { label: string; href?: string };
type GroupItem = { label: string; items: LeafItem[] };

// 트리에 보이는 메뉴 구조는 erp-menu.ts의 MENU_GROUPS를 그대로 쓴다 —
// 예전엔 여기 따로 목록이 있어서(할일관리가 여기서만 대시보드 바로
// 다음 순서였다) 빠른검색/최근메뉴의 순서와 어긋나 있었다.
const TREE: GroupItem[] = MENU_GROUPS;

// 그룹당 아이콘 하나 — 사이드바를 접었을 때는 이 아이콘이 그 메뉴를
// 구분하는 유일한 단서라서(라벨 텍스트가 안 보임), 목록에 없는
// 그룹이어도 화면이 깨지지 않게 GROUP_ICONS[label]가 undefined면
// 그냥 아이콘 없이 렌더링한다.
const ICON_STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

const GROUP_ICONS: Record<string, ReactNode> = {
  "메인 대시보드": (
    <svg {...ICON_STROKE}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9h14v-9" />
      <path d="M9.5 19v-5h5v5" />
    </svg>
  ),
  매출관리: (
    <svg {...ICON_STROKE}>
      <path d="M4 17 10 11l4 4 6-7" />
      <path d="M14.5 8H20v5.5" />
    </svg>
  ),
  매입관리: (
    <svg {...ICON_STROKE}>
      <path d="M4 8l6 6 4-4 6 7" />
      <path d="M14.5 17H20v-5.5" />
    </svg>
  ),
  재고관리: (
    <svg {...ICON_STROKE}>
      <path d="M12 3 4 7.5V16.5L12 21l8-4.5V7.5z" />
      <path d="M4 7.5 12 12l8-4.5" />
      <path d="M12 12v9" />
    </svg>
  ),
  품목관리: (
    <svg {...ICON_STROKE}>
      <path d="M12.6 3.2 20 10.6c.5.5.5 1.4 0 2L14 18.6c-.6.6-1.5.6-2 0L4.6 11.2c-.3-.3-.4-.6-.4-1V4.6c0-.6.4-1 1-1H10c.4 0 .8.2 1 .4z" />
      <circle cx="8.2" cy="8.2" r="1.4" />
    </svg>
  ),
  거래처관리: (
    <svg {...ICON_STROKE}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.6-3 2.7-5 5.5-5s4.9 2 5.5 5" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M15.8 13.5c2.2.3 3.8 2 4.3 4.3" />
    </svg>
  ),
  할일관리: (
    <svg {...ICON_STROKE}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8.5 12.5 2.3 2.3 4.7-4.8" />
    </svg>
  ),
  공지사항: (
    <svg {...ICON_STROKE}>
      <path d="M4 10v4h3l5 4V6L7 10H4z" />
      <path d="M16.5 9a4 4 0 0 1 0 6" />
      <path d="M19.3 6.5a8 8 0 0 1 0 11" />
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
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </svg>
  ),
  환경설정: (
    <svg {...ICON_STROKE}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.4.7a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.4 2.3a7.6 7.6 0 0 0-2.6 1.5l-2.4-.7-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.4-.7a7.6 7.6 0 0 0 2.6 1.5L10 22h4l.4-2.3a7.6 7.6 0 0 0 2.6-1.5l2.4.7 2-3.4z" />
    </svg>
  ),
  시스템관리: (
    <svg {...ICON_STROKE}>
      <path d="M12 3 4.5 6v6c0 4.5 3.2 7.5 7.5 9 4.3-1.5 7.5-4.5 7.5-9V6z" />
      <path d="m9 12 2 2 4-4.5" />
    </svg>
  ),
};

function formatMB(bytes: number) {
  return (bytes / (1024 * 1024)).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

type UsageRow =
  | { kind: "bar"; label: string; usedBytes: number; limitBytes: number; note: string }
  | { kind: "simple"; label: string; usedBytes: number; note: string };

function UsageBar(row: UsageRow) {
  if (row.kind === "simple") {
    return (
      <div className="erp-tree-usage-row">
        <div className="erp-tree-usage-label">
          <span>{row.label}</span>
        </div>
        <div className="erp-tree-usage-sub">
          {formatMB(row.usedBytes)}MB ({row.note})
        </div>
      </div>
    );
  }

  const { label, usedBytes, limitBytes, note } = row;
  const percent = Math.min(100, Math.round((usedBytes / limitBytes) * 100));
  const level =
    percent >= 90 ? "danger" : percent >= 70 ? "warning" : "success";
  const barColor =
    level === "danger"
      ? "var(--erp-danger)"
      : level === "warning"
        ? "var(--erp-warning)"
        : "var(--erp-success)";

  return (
    <div className="erp-tree-usage-row erp-tree-usage-row-donut">
      <div
        className="erp-usage-donut"
        style={{ background: `conic-gradient(${barColor} ${percent}%, #e2e6ec 0)` }}
      >
        <span className="erp-usage-donut-pct">{percent}%</span>
      </div>
      <div className="erp-tree-usage-donut-text">
        <div className="erp-tree-usage-label">
          <span>{label}</span>
        </div>
        <div className="erp-tree-usage-sub">
          {formatMB(usedBytes)}MB / {formatMB(limitBytes)}MB ({note})
        </div>
      </div>
    </div>
  );
}

function UsageWidget({
  dbSizeBytes,
  storageSizeBytes,
  vpsDisk,
  netlifyUsage,
  collapsed,
}: {
  dbSizeBytes: number | null;
  storageSizeBytes: number | null;
  vpsDisk: VpsDiskUsage | null;
  netlifyUsage: NetlifyUsageResult;
  collapsed: boolean;
}) {
  if (collapsed) return null;

  const rows: UsageRow[] = [];
  if (dbSizeBytes != null) {
    rows.push({
      kind: "bar",
      label: "DB 용량",
      usedBytes: dbSizeBytes,
      limitBytes: FREE_TIER_DB_LIMIT_BYTES,
      note: "무료플랜",
    });
  }
  if (storageSizeBytes != null) {
    rows.push({
      kind: "bar",
      label: "파일저장",
      usedBytes: storageSizeBytes,
      limitBytes: FREE_TIER_STORAGE_LIMIT_BYTES,
      note: "무료플랜",
    });
  }
  if (vpsDisk != null) {
    rows.push({
      kind: "bar",
      label: "서버 디스크",
      usedBytes: vpsDisk.usedBytes,
      limitBytes: vpsDisk.totalBytes,
      note: "USD $5 플랜",
    });
  }
  // 넷리파이 배포본에는 실제 서버 디스크가 없어서, 대신 넷리파이 계정의
  // 대역폭(bandwidth) 사용량을 보여준다(NETLIFY_API_TOKEN 설정 시에만).
  // 2025년 9월 이후 신규 계정은 크레딧제라 고정 한도(included)가 없어서
  // (API가 null로 내려줌) 이 경우엔 퍼센트 막대 없이 사용량만 보여준다.
  //
  // 이 크레딧제에서는 대역폭뿐 아니라 배포(Production deploys)·컴퓨트
  // (Compute)·요청 수(Web requests)도 같은 크레딧 풀(무료 플랜 월 300개)을
  // 나눠쓴다 — 실측 기준 배포 1회가 약 15크레딧으로 대역폭보다 훨씬 크게
  // 소모된다. 넷리파이 공개 API(openapi 스펙 기준, 2026-08 확인)에는 계정
  // 전체 잔여 크레딧을 돌려주는 엔드포인트가 없어서(대역폭만 조회 가능),
  // 여기서는 대역폭만 보여줄 수 있다 — 전체 크레딧 잔량은 넷리파이 대시보드
  // Billing 화면에서 직접 확인해야 한다는 걸 note에 명시해 오해를 막는다.
  if (netlifyUsage.usage != null) {
    if (netlifyUsage.usage.includedBytes != null) {
      rows.push({
        kind: "bar",
        label: "넷리파이 대역폭",
        usedBytes: netlifyUsage.usage.usedBytes,
        limitBytes: netlifyUsage.usage.includedBytes,
        note: "무료플랜",
      });
    } else {
      rows.push({
        kind: "simple",
        label: "넷리파이 대역폭",
        usedBytes: netlifyUsage.usage.usedBytes,
        note: "크레딧제 - 대역폭 외 배포/컴퓨트도 크레딧 소모, 전체 잔량은 대시보드에서 확인",
      });
    }
  }

  if (!rows.length && !netlifyUsage.error) return null;

  return (
    <div className="erp-tree-usage">
      {rows.map((row) => (
        <UsageBar key={row.label} {...row} />
      ))}
      {netlifyUsage.error && (
        <div
          className="erp-tree-usage-sub"
          style={{ color: "var(--erp-danger)" }}
        >
          넷리파이 사용량 조회 실패: {netlifyUsage.error}
        </div>
      )}
    </div>
  );
}

export function TreeMenu({
  dbSizeBytes,
  storageSizeBytes,
  vpsDisk,
  netlifyUsage,
  collapsed,
  isMobile,
  onToggleCollapsed,
}: {
  dbSizeBytes: number | null;
  storageSizeBytes: number | null;
  vpsDisk: VpsDiskUsage | null;
  netlifyUsage: NetlifyUsageResult;
  collapsed: boolean;
  isMobile: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
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

        <UsageWidget
          dbSizeBytes={dbSizeBytes}
          storageSizeBytes={storageSizeBytes}
          vpsDisk={vpsDisk}
          netlifyUsage={netlifyUsage}
          collapsed={collapsed}
        />
      </nav>
    </>
  );
}
