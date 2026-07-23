import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { TodoForm, type TodoInitialItem } from "@/components/todo-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { formatPaperCalcSizeLines, mergePaperCalcInputItems, type PaperCalcSizeRow } from "@/lib/paper-calc-summary";
import { todoTypeLabel } from "@/lib/todo-flow";
import { deleteTodo, updateTodo } from "../actions";

export default async function TodoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: row, error }, { data: products }, { data: calcs }] = await Promise.all([
    supabase
      .from("todos")
      .select(
        "id, title, memo, items, todo_type, ship_date, purchase_done_at, sale_done_at, due_date, done, profiles!created_by(full_name)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("products").select("id, sku, name, spec, unit, base_package_qty").order("name"),
    supabase
      .from("paper_calculations")
      .select("id, input_items, total_sheet")
      .eq("todo_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (error) {
    return (
      <div className="erp-grid-empty" style={{ padding: 24 }}>
        할 일을 불러오지 못했습니다: {error.message}
      </div>
    );
  }

  if (!row) {
    notFound();
  }

  const items: TodoInitialItem[] = Array.isArray(row.items) ? (row.items as TodoInitialItem[]) : [];

  let paperCalcSizes: PaperCalcSizeRow[] = [];
  let paperCalcTotalSheet = 0;
  for (const calc of calcs ?? []) {
    paperCalcSizes = mergePaperCalcInputItems(paperCalcSizes, calc.input_items);
    paperCalcTotalSheet += calc.total_sheet;
  }
  const paperCalcSizeLines = formatPaperCalcSizeLines(paperCalcSizes);
  const latestCalcId = calcs?.[0]?.id;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/todos" } }} />
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">할일관리 &gt; 수정</h1>

      <div className="erp-toolbar">
        <Link href="/todos" className="erp-btn erp-btn-danger">
          ESC 목록으로
        </Link>
        <DeleteButton action={deleteTodo} id={row.id} confirmMessage="이 할 일을 삭제하시겠습니까?" />
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">{row.title}</span>
        </div>
        <div className="erp-detail-body">
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: "var(--erp-text-muted)" }}>
            <span>작성자: {row.profiles?.full_name ?? "-"}</span>
            <span>유형: {todoTypeLabel(row.todo_type, row.ship_date, row.due_date)}</span>
            <span>
              상태:{" "}
              {row.done
                ? "완료"
                : row.todo_type === "both"
                  ? `진행중 (매입 ${row.purchase_done_at ? "완료" : "전"} · 매출 ${row.sale_done_at ? "완료" : "전"})`
                  : "진행중"}
            </span>
          </div>

          {paperCalcSizeLines.length > 0 && (
            <div className="erp-grid-wrap mb-4">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>
                      모조지 계산 <span className="erp-badge erp-badge-muted">연결됨</span>
                    </th>
                    <th style={{ width: 140 }}>규격</th>
                    <th className="num" style={{ width: 100 }}>
                      수량
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paperCalcSizeLines.map((line, i) => {
                    const [spec, qty] = line.split(" : ");
                    return (
                      <tr key={i}>
                        <td style={{ color: "var(--erp-text-muted)" }}>ㄴ 모조지</td>
                        <td style={{ color: "var(--erp-text-muted)" }}>{spec}</td>
                        <td className="num">{qty}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ fontWeight: 700 }}>
                      합계 {paperCalcTotalSheet.toLocaleString()}연
                    </td>
                    <td className="num">
                      {latestCalcId && (
                        <Link href={`/paper-calc/view/${latestCalcId}`} style={{ color: "var(--erp-primary)", fontWeight: 700 }}>
                          도면 보기 →
                        </Link>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <TodoForm
            action={updateTodo}
            submitLabel="수정"
            initial={{
              id: row.id,
              title: row.title,
              memo: row.memo,
              dueDate: row.due_date,
              items,
              todoType: row.todo_type,
              shipDate: row.ship_date,
            }}
            products={products ?? []}
          />
        </div>
      </div>
    </div>
  );
}
