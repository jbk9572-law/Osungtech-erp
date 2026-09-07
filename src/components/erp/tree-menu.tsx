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
        style={{ background: `conic-gradient(${barColor} ${percent}%, var(--erp-border) 0)` }}
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
