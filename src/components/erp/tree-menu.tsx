"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
    <div className="erp-tree-usage-row">
      <div className="erp-tree-usage-label">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="erp-tree-usage-bar">
        <div
          className="erp-tree-usage-bar-fill"
          style={{ width: `${percent}%`, background: barColor }}
        />
      </div>
      <div className="erp-tree-usage-sub">
        {formatMB(usedBytes)}MB / {formatMB(limitBytes)}MB ({note})
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
        note: "크레딧제 요금제 - 고정 한도 없음",
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
                  onClick={() =>
                    setOpenGroups((prev) => ({
                      ...prev,
                      [group.label]: !prev[group.label],
                    }))
                  }
                >
                  <span className="erp-tree-caret">{isOpen ? "▾" : "▸"}</span>
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
