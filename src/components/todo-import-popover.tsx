"use client";

import { GridBadge } from "@/components/grid/badge";
import { todoTypeLabel } from "@/lib/todo-flow";
import type { OpenTodoSummary } from "@/app/(dashboard)/todos/actions";

// 매출/매입 등록 폼의 "할일 가져오기" 팝오버 — 두 폼이 이 100줄을 글자 그대로
// 복사해서 쓰고 있었다(차이는 거래처 이름 필드와 "매입완료" 뱃지 표시뿐). 한
// 곳에서만 관리하고, 매출 쪽에서만 보이는 부분은 side로 구분한다.
export function TodoImportPopover({
  side,
  todos,
  importingId,
  onImport,
  onClose,
}: {
  side: "sale" | "purchase";
  todos: OpenTodoSummary[];
  importingId: string | null;
  onImport: (todo: OpenTodoSummary) => void;
  onClose: () => void;
}) {
  return (
    <div className="erp-u-absolute erp-u-bg-panel erp-u-border erp-u-radius-xl"
      style={{ top: "100%", right: 4, zIndex: 20, width: 420, maxWidth: "90vw", maxHeight: 320, overflowY: "auto", boxShadow: "var(--erp-shadow-md)" }}
    >
      <div className="erp-u-flex erp-u-items-center erp-u-justify-between erp-u-bold erp-u-pad-6-10 erp-u-text-compact erp-u-bb-border"
      >
        <span>완료 안 한 할 일</span>
        <button
          type="button"
          onClick={() => onClose()}
          className="erp-btn erp-btn-dark erp-btn-xs erp-u-minw-0"
        >
          닫기
        </button>
      </div>
      {todos.length === 0 ? (
        <p className="erp-home-empty erp-u-p-10">
          완료 안 한 할 일이 없습니다.
        </p>
      ) : (
        todos.map((todo) => {
          const itemCount = todo.items.length;
          const isImporting = importingId === todo.id;
      const counterpartName = side === "sale" ? todo.customer_name : todo.supplier_name;
          return (
            <div className="erp-u-flex erp-u-items-center erp-u-justify-between erp-u-gap-8 erp-u-pad-6-10 erp-u-text-compact erp-u-bb-divider"
              key={todo.id}
            >
              <div className="erp-u-minw-0">
                <div className="erp-u-semibold">
                  {todo.title}
                  <GridBadge tone="muted" style={{ marginLeft: 6 }}>
                    {todoTypeLabel(
                      todo.todo_type,
                      todo.ship_date,
                      todo.due_date,
                    )}
                  </GridBadge>
                  {side === "sale" && todo.todo_type === "both" && (
                    <GridBadge
                      tone={todo.purchase_done_at ? "ok" : "warn"}
                      style={{ marginLeft: 4 }}
                    >
                      {todo.purchase_done_at ? "매입완료" : "매입 전"}
                    </GridBadge>
                  )}
                </div>
                <div className="erp-u-muted erp-u-text-caption"
                >
                  {counterpartName ? `${counterpartName} · ` : ""}
                  {todo.due_date
                    ? `마감 ${todo.due_date} · `
                    : ""}품목 {itemCount}건
                </div>
              </div>
              <button
                type="button"
                onClick={() => onImport(todo)}
                className="erp-btn erp-btn-xs erp-u-minw-0"
                style={{ flexShrink: 0 }}
                disabled={isImporting}
              >
                {isImporting ? "가져오는 중..." : "가져오기"}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
