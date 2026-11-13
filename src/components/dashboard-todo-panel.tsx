"use client";

import { useState } from "react";
import { DashboardTodoRows } from "@/components/dashboard-todo-rows";
import type { SourceId } from "@/lib/dashboard-sources";
import type { TodoItem } from "@/lib/dashboard-todo";

// 메인 화면 "오늘 할 일"·"소식" — 사용자가 고른 내용(결재 대기·연체 미수금·공지 등)을 탭으로 나눠 보고, 줄 끝의
// 버튼으로 바로 해당 화면에 들어가 처리한다. 어떤 탭을 어떤 순서로 둘지는 화면 편집에서 고른다.
export type TodoTab = { id: SourceId; title: string; items: TodoItem[]; note?: string | null };

export function DashboardTodoPanel({
  tabs,
  label = "오늘 할 일 종류",
  empty = "오늘 처리할 일이 없습니다.",
}: {
  tabs: TodoTab[];
  label?: string;
  empty?: string;
}) {
  const [tab, setTab] = useState<"all" | SourceId>("all");
  const all = tabs.flatMap((t) => t.items);
  const active = tab === "all" || tabs.some((t) => t.id === tab) ? tab : "all";
  const shown = active === "all" ? all : (tabs.find((t) => t.id === active)?.items ?? []);
  // 탭 아래 한 줄 안내 — "전체"에서는 탭들의 안내를 중복 없이 모아서 보여준다.
  const note = [...new Set((active === "all" ? tabs : tabs.filter((t) => t.id === active)).map((t) => t.note).filter(Boolean))].join(" · ");
  const nav: { id: "all" | SourceId; title: string; n: number }[] = [
    { id: "all", title: "전체", n: all.length },
    ...tabs.map((t) => ({ id: t.id, title: t.title, n: t.items.length })),
  ];

  return (
    <div className="erp-todo-panel">
      <div className="erp-todo-tabs" role="tablist" aria-label={label}>
        {nav.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            className={`erp-todo-tab${active === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.title} <span className="erp-todo-count">{t.n}</span>
          </button>
        ))}
      </div>
      {note ? <p className="erp-todo-note">{note}</p> : null}
      {shown.length ? (
        <DashboardTodoRows items={shown} />
      ) : (
        <p className="erp-home-empty">{tabs.length ? empty : "보여줄 내용이 없습니다. 화면 편집에서 탭에 넣을 내용을 고르세요."}</p>
      )}
    </div>
  );
}
