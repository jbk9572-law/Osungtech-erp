"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FREE_TIER_DB_LIMIT_BYTES,
  FREE_TIER_STORAGE_LIMIT_BYTES,
} from "@/lib/db-usage";
import type { VpsDiskUsage } from "@/lib/vps-usage";

type LeafItem = { label: string; href?: string };
type GroupItem = { label: string; items: LeafItem[] };

const TREE: GroupItem[] = [
  { label: "메인 대시보드", items: [{ label: "홈", href: "/dashboard" }] },
  { label: "매출관리", items: [{ label: "매출관리", href: "/sales" }] },
  { label: "매입관리", items: [{ label: "매입관리", href: "/purchases" }] },
  {
    label: "재고관리",
    items: [{ label: "재고현황", href: "/inventory" }],
  },
  { label: "품목관리", items: [{ label: "품목관리", href: "/products" }] },
  {
    label: "거래처관리",
    items: [
      { label: "판매처관리", href: "/customers" },
      { label: "공급처관리", href: "/suppliers" },
    ],
  },
  { label: "할일관리", items: [{ label: "할일관리", href: "/todos" }] },
  { label: "공지사항", items: [{ label: "공지사항", href: "/announcements" }] },
  {
    label: "환경설정",
    items: [{ label: "회사정보", href: "/settings/company" }],
  },
  { label: "시스템관리", items: [{ label: "권한관리" }] },
  {
    label: "확장모듈",
    items: [
      { label: "모조지 계산", href: "/paper-calc" },
      { label: "월별 리포트", href: "/reports/monthly" },
    ],
  },
];

function formatMB(bytes: number) {
  return (bytes / (1024 * 1024)).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

type UsageRow = {
  label: string;
  usedBytes: number;
  limitBytes: number;
  note: string;
};

function UsageBar({ label, usedBytes, limitBytes, note }: UsageRow) {
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
  collapsed,
}: {
  dbSizeBytes: number | null;
  storageSizeBytes: number | null;
  vpsDisk: VpsDiskUsage | null;
  collapsed: boolean;
}) {
  if (collapsed) return null;

  const rows: UsageRow[] = [];
  if (dbSizeBytes != null) {
    rows.push({
      label: "DB 용량",
      usedBytes: dbSizeBytes,
      limitBytes: FREE_TIER_DB_LIMIT_BYTES,
      note: "무료플랜",
    });
  }
  if (storageSizeBytes != null) {
    rows.push({
      label: "파일저장",
      usedBytes: storageSizeBytes,
      limitBytes: FREE_TIER_STORAGE_LIMIT_BYTES,
      note: "무료플랜",
    });
  }
  if (vpsDisk != null) {
    rows.push({
      label: "서버 디스크",
      usedBytes: vpsDisk.usedBytes,
      limitBytes: vpsDisk.totalBytes,
      note: "USD $5 플랜",
    });
  }

  if (!rows.length) return null;

  return (
    <div className="erp-tree-usage">
      {rows.map((row) => (
        <UsageBar key={row.label} {...row} />
      ))}
    </div>
  );
}

export function TreeMenu({
  dbSizeBytes,
  storageSizeBytes,
  vpsDisk,
}: {
  dbSizeBytes: number | null;
  storageSizeBytes: number | null;
  vpsDisk: VpsDiskUsage | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // 모바일/좁은 화면에서는 240px 고정 사이드바가 화면 폭 대부분을
  // 차지해버려서, 폭이 768px 아래로 내려가면 자동으로 접는다. 이미
  // 있는 "접기" 로직(라벨 숨김 등)을 그대로 재사용한다.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from matchMedia on mount
    setCollapsed(mq.matches);
    const handleChange = (e: MediaQueryListEvent) => setCollapsed(e.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

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
    <nav className={`erp-tree${collapsed ? " collapsed" : ""}`}>
      <div className="erp-tree-scroll">
        <button
          type="button"
          className="erp-tree-toggle"
          onClick={() => setCollapsed((c) => !c)}
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
        collapsed={collapsed}
      />
    </nav>
  );
}
