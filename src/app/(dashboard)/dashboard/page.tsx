import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { getNotificationSummary } from "@/lib/notifications";
import { todoTypeLabel } from "@/lib/todo-flow";
import { mergePaperCalcInputItems, type PaperCalcSizeRow } from "@/lib/paper-calc-summary";
import { PAPER_STOCK_SKU } from "@/lib/paper-calc-sync";
import { nowInKst } from "@/lib/kst-date";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// "이월" 판정: 등록된 매출/매입 날짜(order_date)가, 실제로 그 건을 입력한
// 달(created_at)보다 나중인지 여부다. 실제 업무는 입력한 당일에 한 것이므로
// created_at의 날짜(실제 입력일)에 표시하되, order_date는 회계상 다음 달
// 실적으로 잡으려고 일부러 넘겨둔 것이므로 그 금액을 입력일의 매출/매입
// 합계(salesTotal/purchaseTotal)에 더하면 안 된다 — 그러면 아직 도래하지
// 않은 달의 실적이 이번 달 실적에 섞여버린다. 그래서 salesItems/
// purchaseItems 목록에는 다른 품목과 똑같이 끼워 넣어 거래처/품목 트리에
// 자연스럽게 같이 보이게 하되, isCarryover 플래그만 표시해 화면에서 "이월"
// 배지로 구분하고, salesCount/salesTotal(정식 합계)에는 넣지 않는다(아래
// dataByDate 구성 부분 참고). order_date에 해당하는 달력 날짜에는 원래
// 매출/매입처럼 보이면 안 된다.
function isCarryover(orderDate: string, createdAt: string) {
  const created = new Date(createdAt);
  const createdMonth = `${created.getFullYear()}-${pad(created.getMonth() + 1)}`;
  return orderDate.slice(0, 7) > createdMonth;
}

function toLocalDateStr(iso: string) {
  const d = new Date(iso);
  return toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function buildWeeks(year: number, month: number) {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: ({ dateStr: string; day: number } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ dateStr: toDateStr(year, month, day), day });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  // 서버는 보통 UTC로 도는데, "오늘"을 그냥 new Date()로 구하면 한국
  // 자정~오전 9시 사이엔 서버가 아직 어제라고 착각한다 — 한국 기준으로
  // 고정해서 구한다(자세한 이유는 kst-date.ts 참고).
  const now = nowInKst();
  const [year, month] = monthParam
    ? monthParam.split("-").map(Number)
    : [now.getUTCFullYear(), now.getUTCMonth() + 1];

  const monthStart = toDateStr(year, month, 1);
  const monthEnd = toDateStr(year, month, new Date(year, month, 0).getDate());

  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const prevMonthHref = `/dashboard?month=${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}`;
  const nextMonthHref = `/dashboard?month=${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}`;

  const supabase = await createClient();
  const todayStr = toDateStr(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  // 이월 후보를 DB에서 걸러낼 때, order_date와 created_at을 직접 비교하는
  // 조건은 PostgREST 필터로 표현할 수 없어(두 컬럼끼리 비교) 넉넉한 기간
  // 범위로 먼저 가져온 뒤 isCarryover()로 정확히 골라낸다. 실제로 이월
  // 등록은 항상 월말 즈음 다음 달 날짜로만 하므로, 지난 6개월~다음 3개월이면
  // 실사용에서 놓칠 일이 없다.
  const carryoverRangeStart = new Date(now.getUTCFullYear(), now.getUTCMonth() - 6, 1);
  const carryoverRangeEnd = new Date(now.getUTCFullYear(), now.getUTCMonth() + 4, 0);
  const carryoverFrom = toDateStr(
    carryoverRangeStart.getFullYear(),
    carryoverRangeStart.getMonth() + 1,
    1
  );
  const carryoverTo = toDateStr(
    carryoverRangeEnd.getFullYear(),
    carryoverRangeEnd.getMonth() + 1,
    carryoverRangeEnd.getDate()
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { count: productCount },
    { data: salesItems },
    { data: purchaseItems },
    { data: salesPaperCalcs },
    { data: purchasePaperCalcs },
    { data: paperStockProduct },
    { data: notes },
    { data: recentNotes },
    { data: company },
    { data: carryoverSales },
    { data: carryoverPurchases },
    notifications,
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase
      .from("sales_order_items")
      .select(
        "quantity, unit_price, spec, remark, sales_order_id, products(sku, name, unit, spec), sales_orders!inner(order_date, created_at, customers(name))"
      )
      .gte("sales_orders.order_date", monthStart)
      .lte("sales_orders.order_date", monthEnd),
    supabase
      .from("purchase_order_items")
      .select(
        "quantity, unit_cost, spec, remark, purchase_order_id, products(sku, name, unit, spec), purchase_orders!inner(purchase_date, created_at, suppliers(name))"
      )
      .gte("purchase_orders.purchase_date", monthStart)
      .lte("purchase_orders.purchase_date", monthEnd),
    supabase
      .from("paper_calculations")
      .select("input_items, sales_orders!inner(order_date, customers(name))")
      .gte("sales_orders.order_date", monthStart)
      .lte("sales_orders.order_date", monthEnd),
    supabase
      .from("paper_calculations")
      .select("input_items, purchase_orders!inner(purchase_date, suppliers(name))")
      .gte("purchase_orders.purchase_date", monthStart)
      .lte("purchase_orders.purchase_date", monthEnd),
    supabase.from("products").select("name").eq("sku", PAPER_STOCK_SKU).maybeSingle(),
    supabase
      .from("calendar_notes")
      .select("note_date, content")
      .gte("note_date", monthStart)
      .lte("note_date", monthEnd),
    supabase
      .from("calendar_notes")
      .select("note_date, content")
      .gte("note_date", monthStart)
      .lte("note_date", monthEnd)
      .order("note_date", { ascending: false })
      .limit(5),
    supabase.from("company_profile").select("name, logo_mark_url").eq("id", 1).maybeSingle(),
    supabase
      .from("sales_order_items")
      .select(
        "quantity, unit_price, spec, remark, sales_order_id, products(name, unit, spec), sales_orders!inner(order_date, created_at, customers(name))"
      )
      .gte("sales_orders.order_date", carryoverFrom)
      .lte("sales_orders.order_date", carryoverTo)
      .order("order_date", { referencedTable: "sales_orders", ascending: true }),
    supabase
      .from("purchase_order_items")
      .select(
        "quantity, unit_cost, spec, remark, purchase_order_id, products(name, unit, spec), purchase_orders!inner(purchase_date, created_at, suppliers(name))"
      )
      .gte("purchase_orders.purchase_date", carryoverFrom)
      .lte("purchase_orders.purchase_date", carryoverTo)
      .order("purchase_date", { referencedTable: "purchase_orders", ascending: true }),
    user
      ? getNotificationSummary(supabase, user.id)
      : Promise.resolve({ announcements: [], todos: [], lowStock: [] }),
  ]);

  const unreadAnnouncements = notifications.announcements;
  const dueSoonTodos = notifications.todos;
  const lowStockItems = notifications.lowStock;

  type ItemRow = {
    partnerName: string;
    productName: string;
    spec: string;
    unit: string;
    quantity: number;
    amount: number;
    orderId: string;
    remark: string | null;
    isCarryover: boolean;
  };

  type PaperCalcPartnerEntry = { sizes: PaperCalcSizeRow[]; totalSheet: number; amount: number };

  type DayData = {
    salesCount: number;
    salesTotal: number;
    salesItems: ItemRow[];
    purchaseCount: number;
    purchaseTotal: number;
    purchaseItems: ItemRow[];
    salesPaperCalcByPartner: Record<string, PaperCalcPartnerEntry>;
    purchasePaperCalcByPartner: Record<string, PaperCalcPartnerEntry>;
    note: string;
  };

  const dataByDate: Record<string, DayData> = {};

  function ensure(date: string): DayData {
    if (!dataByDate[date]) {
      dataByDate[date] = {
        salesCount: 0,
        salesTotal: 0,
        salesItems: [],
        purchaseCount: 0,
        purchaseTotal: 0,
        purchaseItems: [],
        salesPaperCalcByPartner: {},
        purchasePaperCalcByPartner: {},
        note: "",
      };
    }
    return dataByDate[date];
  }

  // 거래처별로 모조지 계산 사이즈를 누적한다. 매출/매입 목록에서 거래처 이름
  // 아래에 "모조지" 카테고리로 같이 묶어 보여주기 위함(어느 거래처로 나간
  // 모조지인지 알 수 있게).
  function ensurePaperCalcPartner(
    byPartner: Record<string, PaperCalcPartnerEntry>,
    partnerName: string
  ): PaperCalcPartnerEntry {
    if (!byPartner[partnerName]) {
      byPartner[partnerName] = { sizes: [], totalSheet: 0, amount: 0 };
    }
    return byPartner[partnerName];
  }

  // paper_calculations.input_items는 사이즈별 내역(참고용 줄)을 보여주는
  // 데만 쓴다. 자동 계산값(total_sheet)은 여기서 더하지 않는다 — 거래처
  // 협의로 TG0 수량을 수동 오버라이드한 주문은 sales_order_items.quantity가
  // 이미 오버라이드된 값으로 반영돼 있는데, 여기서 total_sheet(자동값)를
  // 따로 또 더하면 대시보드에만 오버라이드 적용 전 수량이 보이는 문제가
  // 생긴다. 연 합계는 아래 품목 순회에서 실제 quantity로 채운다.
  function addPaperCalcSizesForPartner(
    byPartner: Record<string, PaperCalcPartnerEntry>,
    partnerName: string,
    inputItems: unknown
  ) {
    const entry = ensurePaperCalcPartner(byPartner, partnerName);
    entry.sizes = mergePaperCalcInputItems(entry.sizes, inputItems);
  }

  for (const item of salesItems ?? []) {
    const date = item.sales_orders.order_date;
    // 이월 건은 달력의 order_date 자리가 아니라 입력일(created_at) 쪽에서만
    // 보여준다(아래 이월 병합 루프 참고).
    if (isCarryover(date, item.sales_orders.created_at)) continue;
    const amount = item.quantity * Number(item.unit_price);
    const bucket = ensure(date);
    bucket.salesCount += 1;
    bucket.salesTotal += amount;
    // 모조지(TG0) 라인은 계산에서 자동 반영된 것이라 규격이 없다.
    // 아래 "모조지 사용량" 섹션에서 사이즈별로 정확히 보여주므로 목록에는
    // 넣지 않되, 이 라인의 실제 금액은 그 섹션의 합계 가격으로 옮겨 담는다.
    if (item.products?.sku === PAPER_STOCK_SKU) {
      const partnerName = item.sales_orders.customers?.name ?? "출고처 미상";
      const entry = ensurePaperCalcPartner(bucket.salesPaperCalcByPartner, partnerName);
      entry.amount += amount;
      entry.totalSheet += item.quantity;
      continue;
    }
    bucket.salesItems.push({
      partnerName: item.sales_orders.customers?.name ?? "출고처 미상",
      productName: item.products?.name ?? "상품 미상",
      spec: item.spec || item.products?.spec || "",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      amount,
      orderId: item.sales_order_id,
      remark: item.remark,
      isCarryover: false,
    });
  }

  for (const item of purchaseItems ?? []) {
    const date = item.purchase_orders.purchase_date;
    if (isCarryover(date, item.purchase_orders.created_at)) continue;
    const amount = item.quantity * Number(item.unit_cost);
    const bucket = ensure(date);
    bucket.purchaseCount += 1;
    bucket.purchaseTotal += amount;
    if (item.products?.sku === PAPER_STOCK_SKU) {
      const partnerName = item.purchase_orders.suppliers?.name ?? "공급처 미상";
      const entry = ensurePaperCalcPartner(bucket.purchasePaperCalcByPartner, partnerName);
      entry.amount += amount;
      entry.totalSheet += item.quantity;
      continue;
    }
    bucket.purchaseItems.push({
      partnerName: item.purchase_orders.suppliers?.name ?? "공급처 미상",
      productName: item.products?.name ?? "상품 미상",
      spec: item.spec || item.products?.spec || "",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      amount,
      orderId: item.purchase_order_id,
      remark: item.remark,
      isCarryover: false,
    });
  }

  // 이월 건: 실제로 입력한 날짜(created_at)의 달력 날짜에서 다른 품목과
  // 똑같이 salesItems/purchaseItems 목록에 끼워 넣는다(거래처/품목 트리에
  // 자연스럽게 같이 보이도록) — 다만 isCarryover 플래그를 달아 화면에서
  // "이월" 배지로 구분하고, order_date(회계상 날짜)는 아직 도래하지 않은
  // 달의 실적으로 잡으려고 일부러 넘겨둔 것이므로 이 금액을 입력일의
  // salesCount/salesTotal(그날의 정식 매출/매입 합계)에는 더하지 않는다 —
  // 더하면 아직 오지 않은 달의 매출/매입이 이번 달 실적에 섞여버린다. 지금
  // 보고 있는 달[monthStart, monthEnd] 범위 안에 입력일이 들어올 때만
  // 반영한다(다른 달을 보는 중이면 여기서 걸러진다).
  for (const item of carryoverSales ?? []) {
    if (!isCarryover(item.sales_orders.order_date, item.sales_orders.created_at)) continue;
    const date = toLocalDateStr(item.sales_orders.created_at);
    if (date < monthStart || date > monthEnd) continue;
    ensure(date).salesItems.push({
      partnerName: item.sales_orders.customers?.name ?? "출고처 미상",
      productName: item.products?.name ?? "상품 미상",
      spec: item.spec || item.products?.spec || "",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      amount: item.quantity * Number(item.unit_price),
      orderId: item.sales_order_id,
      remark: item.remark,
      isCarryover: true,
    });
  }

  for (const item of carryoverPurchases ?? []) {
    if (!isCarryover(item.purchase_orders.purchase_date, item.purchase_orders.created_at)) continue;
    const date = toLocalDateStr(item.purchase_orders.created_at);
    if (date < monthStart || date > monthEnd) continue;
    ensure(date).purchaseItems.push({
      partnerName: item.purchase_orders.suppliers?.name ?? "공급처 미상",
      productName: item.products?.name ?? "상품 미상",
      spec: item.spec || item.products?.spec || "",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      amount: item.quantity * Number(item.unit_cost),
      orderId: item.purchase_order_id,
      remark: item.remark,
      isCarryover: true,
    });
  }

  for (const calc of salesPaperCalcs ?? []) {
    const bucket = ensure(calc.sales_orders.order_date);
    const partnerName = calc.sales_orders.customers?.name ?? "출고처 미상";
    addPaperCalcSizesForPartner(bucket.salesPaperCalcByPartner, partnerName, calc.input_items);
  }

  for (const calc of purchasePaperCalcs ?? []) {
    const bucket = ensure(calc.purchase_orders.purchase_date);
    const partnerName = calc.purchase_orders.suppliers?.name ?? "공급처 미상";
    addPaperCalcSizesForPartner(bucket.purchasePaperCalcByPartner, partnerName, calc.input_items);
  }

  for (const note of notes ?? []) {
    ensure(note.note_date).note = note.content;
  }

  const weeks = buildWeeks(year, month);

  // 오늘 매출/매입, 재고위험 건수는 전부 바로 아래 달력 옆 "오늘의 업무"
  // 패널과 "재고위험" 패널에 이미 자세히 나오는 정보라, 요약 카드에는
  // 그 두 패널에는 없는(달력은 하루치만 보여줌) 이번달 누계만 둔다.
  const monthSalesTotal = Object.values(dataByDate).reduce((sum, day) => sum + day.salesTotal, 0);
  const monthSalesCount = Object.values(dataByDate).reduce((sum, day) => sum + day.salesCount, 0);
  const monthPurchaseTotal = Object.values(dataByDate).reduce((sum, day) => sum + day.purchaseTotal, 0);
  const monthPurchaseCount = Object.values(dataByDate).reduce((sum, day) => sum + day.purchaseCount, 0);

  const hasAlerts =
    unreadAnnouncements.length > 0 || dueSoonTodos.length > 0 || lowStockItems.length > 0;

  return (
    <>
      {hasAlerts && (
        <div className="erp-alert-banner">
          {unreadAnnouncements.slice(0, 3).map((a) => (
            <Link key={`a-${a.id}`} href={`/announcements/${a.id}`} className="erp-alert-item">
              <span className="erp-alert-tag">공지</span>
              {a.pinned ? "📌 " : ""}
              {a.title}
            </Link>
          ))}
          {dueSoonTodos.slice(0, 10).map((t) => {
            const overdue = !!t.due_date && t.due_date < todayStr;
            const itemCount = t.itemCount;
            return (
              <Link
                key={`d-${t.id}`}
                href={`/todos/${t.id}`}
                className={`erp-alert-item${overdue ? " danger" : ""}`}
              >
                <span className={`erp-alert-tag${overdue ? " danger" : ""}`}>{overdue ? "지연" : "할 일"}</span>
                {t.title}
                {t.due_date ? ` (${t.due_date})` : ""}
                <span className="erp-badge erp-badge-muted" style={{ marginLeft: 6 }}>
                  {todoTypeLabel(t.todoType, t.shipDate, t.due_date)}
                </span>
                {itemCount > 0 && (
                  <span className="erp-badge erp-badge-muted" style={{ marginLeft: 4 }}>
                    품목 {itemCount}건
                  </span>
                )}
              </Link>
            );
          })}
          {lowStockItems.length > 0 && (
            <Link href="#stock-risk" className="erp-alert-item danger">
              <span className="erp-alert-tag danger">재고</span>
              안전재고 이하 품목이 {lowStockItems.length}건 있습니다 — 자세히 보기 →
            </Link>
          )}
        </div>
      )}
      <div className="erp-hero-row">
        <div className="erp-hero-card" style={{ borderLeftColor: "var(--erp-danger)" }}>
          <div className="erp-hero-label">이번달 매출</div>
          <div className="erp-hero-value">
            {monthSalesCount}건 · {monthSalesTotal.toLocaleString()}원
          </div>
        </div>
        <div className="erp-hero-card" style={{ borderLeftColor: "var(--erp-primary)" }}>
          <div className="erp-hero-label">이번달 매입</div>
          <div className="erp-hero-value">
            {monthPurchaseCount}건 · {monthPurchaseTotal.toLocaleString()}원
          </div>
        </div>
        <div className="erp-hero-card">
          <div className="erp-hero-label">전체 품목 수</div>
          <div className="erp-hero-value">{(productCount ?? 0).toLocaleString()}개</div>
        </div>
      </div>
      <div className="erp-home">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="erp-home-panel" id="stock-risk">
          <div className="erp-home-panel-title">
            <span>재고위험</span>
            {lowStockItems.length > 0 && (
              <span style={{ color: "var(--erp-danger)", fontVariantNumeric: "tabular-nums" }}>
                {lowStockItems.length}건
              </span>
            )}
          </div>
          {lowStockItems.length ? (
            <>
              <div className="erp-home-stock-list">
                {lowStockItems.map((p) => (
                  <Link key={p.id} href={`/inventory/${p.id}`} className="erp-home-stock-row">
                    <span className="name">{p.name}</span>
                    <span className="ratio">
                      현재 {p.quantity.toLocaleString()} / 기준 {p.reorderPoint.toLocaleString()}
                    </span>
                  </Link>
                ))}
              </div>
              <div className="erp-home-stock-footer">
                <Link href="/inventory">재고현황 전체 보기 →</Link>
              </div>
            </>
          ) : (
            <p className="erp-home-empty">안전재고 이하 품목이 없습니다.</p>
          )}
        </div>
      </div>

      <DashboardCalendar
        year={year}
        month={month}
        weeks={weeks}
        dataByDate={dataByDate}
        todayStr={todayStr}
        prevMonthHref={prevMonthHref}
        nextMonthHref={nextMonthHref}
        backgroundLogoUrl={company?.logo_mark_url}
        lowStockToday={lowStockItems.length > 0}
        paperStockProductName={paperStockProduct?.name ?? "모조지"}
      />

      <div className="erp-home-panel">
        <div className="erp-home-panel-title">최근 메모</div>
        {recentNotes?.length ? (
          <div className="erp-home-list">
            {recentNotes.map((note) => (
              <div className="erp-home-list-item" key={note.note_date}>
                <span style={{ color: "var(--erp-text-muted)", fontSize: 11 }}>
                  {note.note_date}
                </span>
                <span className="truncate">{note.content}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="erp-home-empty">등록된 메모가 없습니다.</p>
        )}

        <div className="erp-home-panel-title" style={{ marginTop: 0 }}>
          빠른 실행
        </div>
        <div className="erp-home-list">
          <Link className="erp-home-list-item" href="/sales">
            새 판매 등록
          </Link>
          <Link className="erp-home-list-item" href="/purchases">
            새 입고 등록
          </Link>
          <Link className="erp-home-list-item" href="/products">
            품목 등록
          </Link>
          <Link className="erp-home-list-item" href="/inventory">
            재고 조회
          </Link>
        </div>
      </div>
      </div>
    </>
  );
}
