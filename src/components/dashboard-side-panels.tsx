import Link from "next/link";
import { GuardedLink } from "@/components/erp/guarded-link";
import { formatNumber } from "@/lib/format-number";
import type { OverdueCustomer } from "@/lib/dashboard-todo";

// 메인 대시보드의 작은 위젯 3종(재고위험·최근 메모·빠른 실행) — 서버에서 그려 DashboardWidgetGrid에 넘긴다.
// 위치·크기는 사용자가 저장한 배치가 정하므로 여기서는 카드 하나의 내용만 맡는다.

export function StockRiskPanel({ items }: { items: { id: string; name: string; quantity: number; reorderPoint: number }[] }) {
  return (
    <div className="erp-home-panel" id="stock-risk">
      <div className="erp-home-panel-title">
        <span>재고위험</span>
        {items.length > 0 && <span className="erp-u-danger erp-u-tabular">{items.length}건</span>}
      </div>
      {items.length ? (
        <>
          <div className="erp-home-stock-list">
            {items.map((p) => (
              <Link key={p.id} href={`/inventory/item/${p.id}`} className="erp-home-stock-row">
                <span className="name">{p.name}</span>
                <span className="ratio">
                  현재 {formatNumber(p.quantity)} / 기준 {formatNumber(p.reorderPoint)}
                </span>
              </Link>
            ))}
          </div>
          <div className="erp-home-stock-footer">
            <Link href="/inventory">재고현황 전체 보기 →</Link>
            {" · "}
            <Link href="/inventory/reorder-suggestions">발주 제안 보기 →</Link>
          </div>
        </>
      ) : (
        <p className="erp-home-empty">안전재고 이하 품목이 없습니다.</p>
      )}
    </div>
  );
}

export function RecentMemosPanel({
  notes,
}: {
  notes: { id: string; note_date: string; content: string; profiles?: { full_name: string | null } | null }[] | null;
}) {
  return (
    <div className="erp-home-panel">
      <div className="erp-home-panel-title">최근 메모</div>
      {notes?.length ? (
        <div className="erp-home-list">
          {notes.map((note) => (
            <div className="erp-home-list-item" key={note.id}>
              <span className="erp-u-muted erp-u-text-caption">
                {note.note_date} · {note.profiles?.full_name ?? "익명"}
              </span>
              <span className="truncate">{note.content}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="erp-home-empty">등록된 메모가 없습니다.</p>
      )}
    </div>
  );
}

export function QuickActionsPanel({ showReceivables }: { showReceivables: boolean }) {
  return (
    <div className="erp-home-panel">
      <div className="erp-home-panel-title">빠른 실행</div>
      <div className="erp-home-list">
        <GuardedLink className="erp-home-list-item" href="/sales/new">
          새 판매 등록
        </GuardedLink>
        <GuardedLink className="erp-home-list-item" href="/purchases/new">
          새 입고 등록
        </GuardedLink>
        <Link className="erp-home-list-item" href="/products">
          품목 등록
        </Link>
        <Link className="erp-home-list-item" href="/inventory">
          재고 조회
        </Link>
        {showReceivables && (
          <Link className="erp-home-list-item" href="/receivables">
            미수금 현황
          </Link>
        )}
      </div>
    </div>
  );
}

// 기한 지난 미수금 상위 거래처 — 연체 기준은 메신저 연체 알림과 같다(dashboard-todo.ts).
export function OverdueReceivablesPanel({ items }: { items: OverdueCustomer[] }) {
  return (
    <div className="erp-home-panel">
      <div className="erp-home-panel-title">
        <span>기한 지난 미수금</span>
        {items.length > 0 && <span className="erp-u-danger erp-u-tabular">{items.length}곳</span>}
      </div>
      {items.length ? (
        <>
          <div className="erp-home-list">
            {items.slice(0, 3).map((c) => (
              <Link key={c.id} href="/receivables" className="erp-late-row">
                <span className="erp-u-ellipsis erp-u-nowrap erp-u-overflow-hidden">{c.name}</span>
                <span className="erp-u-tabular">{formatNumber(c.balance)}원</span>
                <span className="erp-u-danger erp-u-tabular">{c.daysOverdue}일</span>
              </Link>
            ))}
          </div>
          <div className="erp-home-stock-footer">
            <Link href="/receivables">미수금 현황 전체 보기 →</Link>
          </div>
        </>
      ) : (
        <p className="erp-home-empty">기한이 지난 미수금이 없습니다.</p>
      )}
    </div>
  );
}
