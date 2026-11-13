import Link from "next/link";
import { DashboardTodoRows } from "@/components/dashboard-todo-rows";
import { sourceMeta, type SourceId } from "@/lib/dashboard-sources";
import type { TodoItem } from "@/lib/dashboard-todo";

// 목록 칸 — 사용자가 고른 내용 하나를 제목 띠 + 줄 목록 + "전체 보기" 링크로 보여준다.
// items가 null이면 권한이 없어졌거나 불러오지 못한 경우라 다시 고르게 안내한다.
export function DashboardSourcePanel({ sourceId, items }: { sourceId: SourceId; items: TodoItem[] | null }) {
  const meta = sourceMeta(sourceId);
  return (
    <div className="erp-home-panel">
      <div className="erp-home-panel-title">
        <span>{meta.title}</span>
        {items && items.length > 0 && <span className="erp-u-danger erp-u-tabular">{items.length}건</span>}
      </div>
      {items === null ? (
        <p className="erp-home-empty">선택한 내용을 볼 수 없습니다. 화면 편집에서 다시 고르세요.</p>
      ) : items.length ? (
        <>
          <DashboardTodoRows items={items} />
          <div className="erp-home-stock-footer">
            <Link href={meta.viewAll}>{meta.title} 전체 보기 →</Link>
          </div>
        </>
      ) : (
        <p className="erp-home-empty">{meta.empty}</p>
      )}
    </div>
  );
}
