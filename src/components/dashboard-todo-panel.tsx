"use client";

import { useState } from "react";
import Link from "next/link";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";
import { TODO_KIND_LABEL, type TodoItem, type TodoKind } from "@/lib/dashboard-todo";

// 메인 화면 "오늘 할 일" — 결재 대기·연체 미수금·내 할 일·이월 건을 탭으로 나눠 보고, 줄 끝의
// 버튼으로 바로 해당 화면에 들어가 처리한다. 항목은 서버에서 buildTodoItems()로 만들어 내려준다.

const KIND_TONE: Record<TodoKind, BadgeTone> = { approval: "warn", overdue: "danger", todo: "info", carryover: "muted" };
const KINDS: TodoKind[] = ["approval", "overdue", "todo", "carryover"];

export function DashboardTodoPanel({ items }: { items: TodoItem[] }) {
  const [tab, setTab] = useState<"all" | TodoKind>("all");
  const count = (k: TodoKind) => items.filter((i) => i.kind === k).length;
  const shown = tab === "all" ? items : items.filter((i) => i.kind === tab);
  const tabs: { id: "all" | TodoKind; label: string; n: number }[] = [
    { id: "all", label: "전체", n: items.length },
    ...KINDS.filter((k) => count(k) > 0).map((k) => ({ id: k, label: TODO_KIND_LABEL[k], n: count(k) })),
  ];

  return (
    <div className="erp-todo-panel">
      <div className="erp-todo-tabs" role="tablist" aria-label="오늘 할 일 종류">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`erp-todo-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label} <span className="erp-todo-count">{t.n}</span>
          </button>
        ))}
      </div>
      {shown.length ? (
        <div>
          {shown.map((i) => (
            <Link key={i.key} href={i.href} className="erp-todo-row">
              <GridBadge tone={KIND_TONE[i.kind]}>{TODO_KIND_LABEL[i.kind]}</GridBadge>
              <span className="erp-todo-title">
                {i.title}
                <span className="erp-todo-sub">{i.sub}</span>
              </span>
              <span className="erp-todo-due">{i.due}</span>
              <span className="erp-todo-go">{i.action}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="erp-home-empty">오늘 처리할 일이 없습니다.</p>
      )}
    </div>
  );
}
