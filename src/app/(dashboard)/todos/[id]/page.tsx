import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { TodoForm, type TodoInitialItem } from "@/components/todo-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { formatPaperCalcSizeLines, mergePaperCalcInputItems, type PaperCalcSizeRow } from "@/lib/paper-calc-summary";
import { todoTypeLabel } from "@/lib/todo-flow";
import { deleteTodo, updateTodo } from "../actions";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";
import { GridBadge } from "@/components/grid/badge";

export default async function TodoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: row, error }, { data: products }, { data: calcs }, { data: suppliers }, { data: customers }, actor] =
    await Promise.all([
      supabase
        .from("todos")
        .select(
          "id, title, memo, items, todo_type, ship_date, supplier_id, customer_id, purchase_done_at, sale_done_at, due_date, done, created_by, profiles!created_by(full_name), suppliers(name), customers(name)"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("products").select("id, sku, name, spec, unit, base_package_qty").order("name"),
      supabase
        .from("paper_calculations")
        .select("id, input_items, total_sheet")
        .eq("todo_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("customers").select("id, name").order("name"),
      getCurrentActor(supabase),
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
  const allowManage = canManage(row.created_by, actor.userId, actor.isAdmin);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/todos" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">할일관리 &gt; 수정</h1>

      <div className="erp-toolbar">
        <Link href="/todos" className="erp-btn erp-btn-danger">
          ESC 목록으로
        </Link>
        {allowManage && (
          <DeleteButton action={deleteTodo} id={row.id} confirmMessage="이 할 일을 삭제하시겠습니까?" />
        )}
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">{row.title}</span>
        </div>
        <div className="erp-detail-body">
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: "var(--erp-text-muted)" }}>
            <span>작성자: {row.profiles?.full_name ?? "-"}</span>
            <span>유형: {todoTypeLabel(row.todo_type, row.ship_date, row.due_date)}</span>
            {row.suppliers?.name && <span>공급처: {row.suppliers.name}</span>}
            {row.customers?.name && <span>출고처: {row.customers.name}</span>}
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
                      모조지 계산 <GridBadge tone="muted">연결됨</GridBadge>
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

          {allowManage ? (
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
                supplierId: row.supplier_id,
                customerId: row.customer_id,
              }}
              products={products ?? []}
              suppliers={suppliers ?? []}
              customers={customers ?? []}
            />
          ) : (
            <div>
              {row.due_date && (
                <p
                  className="mb-3 text-sm"
                  style={{ color: "var(--erp-text-muted)" }}
                >
                  마감일: {new Date(row.due_date).toLocaleDateString("ko-KR")}
                </p>
              )}
              {row.memo && (
                <p
                  className="mb-4"
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 13.5,
                    lineHeight: 1.7,
                    color: "var(--erp-text)",
                  }}
                >
                  {row.memo}
                </p>
              )}
              {items.length > 0 && (
                <div className="erp-grid-wrap">
                  <table className="erp-grid">
                    <thead>
                      <tr>
                        <th>품목</th>
                        <th style={{ width: 160 }}>규격</th>
                        <th style={{ width: 120 }}>관리번호</th>
                        <th className="num" style={{ width: 110 }}>
                          수량
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => {
                        const product = (products ?? []).find(
                          (p) => p.id === item.productId,
                        );
                        return (
                          <tr key={i}>
                            <td>
                              {product
                                ? `${product.sku} · ${product.name}`
                                : "-"}
                            </td>
                            <td style={{ color: "var(--erp-text-muted)" }}>
                              {item.spec || product?.spec || "-"}
                            </td>
                            <td style={{ color: "var(--erp-text-muted)" }}>
                              {item.lotNumber || "-"}
                            </td>
                            <td className="num">
                              {item.quantity.toLocaleString()}{" "}
                              {product?.unit ?? ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p
                className="mt-4 text-xs"
                style={{ color: "var(--erp-text-muted)" }}
              >
                본인이 등록한 할 일만 수정할 수 있습니다. (완료 체크는 누구나 할 수 있습니다.)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
