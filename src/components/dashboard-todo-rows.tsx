import Link from "next/link";
import { GridBadge } from "@/components/grid/badge";
import { sourceMeta } from "@/lib/dashboard-sources";
import type { TodoItem } from "@/lib/dashboard-todo";

// "오늘 할 일"과 목록 칸이 같이 쓰는 줄 모양 — 내용(원천)이 무엇이든 [종류 알약] 제목·부제 | 기한 | 바로가기 버튼으로
// 통일해서, 칸마다 다른 모양이 되지 않게 한다.
export function DashboardTodoRows({ items }: { items: TodoItem[] }) {
  return (
    <div>
      {items.map((i) => {
        const meta = sourceMeta(i.kind);
        return (
          <Link key={i.key} href={i.href} className="erp-todo-row">
            <GridBadge tone={meta.tone}>{meta.title}</GridBadge>
            <span className="erp-todo-title">
              {i.title}
              <span className="erp-todo-sub">{i.sub}</span>
            </span>
            <span className="erp-todo-due">{i.due}</span>
            <span className="erp-todo-go">{i.action}</span>
          </Link>
        );
      })}
    </div>
  );
}
