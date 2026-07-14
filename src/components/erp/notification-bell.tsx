"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type AnnouncementItem = { id: string; title: string; pinned: boolean };
export type DueTodoItem = { id: string; title: string; due_date: string | null };
export type LowStockItem = { id: string; name: string; quantity: number; reorderPoint: number };

export function NotificationBell({
  announcements,
  todos,
  lowStock,
}: {
  announcements: AnnouncementItem[];
  todos: DueTodoItem[];
  lowStock: LowStockItem[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const count = announcements.length + todos.length + lowStock.length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div style={{ position: "relative" }} ref={wrapRef}>
      <button type="button" className="erp-bell-btn" onClick={() => setOpen((o) => !o)} aria-label="알림">
        🔔
        {count > 0 && <span className="erp-bell-badge">{count > 99 ? "99+" : count}</span>}
      </button>
      {open && (
        <div className="erp-ribbon-dropdown erp-bell-dropdown">
          <div className="erp-bell-section-title">
            공지사항{announcements.length > 0 ? ` (${announcements.length})` : ""}
          </div>
          {announcements.length ? (
            announcements.map((a) => (
              <div key={a.id} className="erp-ribbon-dropdown-item">
                <button type="button" onClick={() => go(`/announcements/${a.id}`)}>
                  {a.pinned ? "📌 " : ""}
                  {a.title}
                </button>
              </div>
            ))
          ) : (
            <p className="erp-ribbon-dropdown-empty">읽지 않은 공지사항이 없습니다.</p>
          )}

          <div className="erp-bell-section-title">
            할 일 마감임박{todos.length > 0 ? ` (${todos.length})` : ""}
          </div>
          {todos.length ? (
            todos.map((t) => (
              <div key={t.id} className="erp-ribbon-dropdown-item">
                <button type="button" onClick={() => go(`/todos/${t.id}`)}>
                  <span>{t.title}</span>
                  {t.due_date && (
                    <span style={{ display: "block", marginTop: 2, fontSize: 11, color: "var(--erp-text-muted)" }}>
                      마감 {t.due_date}
                    </span>
                  )}
                </button>
              </div>
            ))
          ) : (
            <p className="erp-ribbon-dropdown-empty">마감 임박한 할 일이 없습니다.</p>
          )}

          <div className="erp-bell-section-title">
            안전재고 부족{lowStock.length > 0 ? ` (${lowStock.length})` : ""}
          </div>
          {lowStock.length ? (
            lowStock.map((p) => (
              <div key={p.id} className="erp-ribbon-dropdown-item">
                <button type="button" onClick={() => go(`/inventory/${p.id}`)}>
                  <span>{p.name}</span>
                  <span style={{ display: "block", marginTop: 2, fontSize: 11, color: "var(--erp-text-muted)" }}>
                    현재 {p.quantity.toLocaleString()} / 기준 {p.reorderPoint.toLocaleString()}
                  </span>
                </button>
              </div>
            ))
          ) : (
            <p className="erp-ribbon-dropdown-empty">안전재고 이하인 품목이 없습니다.</p>
          )}

          <div className="erp-bell-footer">
            <Link href="/announcements" onClick={() => setOpen(false)}>
              공지사항 전체보기
            </Link>
            <Link href="/todos" onClick={() => setOpen(false)}>
              할일 전체보기
            </Link>
            <Link href="/inventory" onClick={() => setOpen(false)}>
              재고현황 보기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
