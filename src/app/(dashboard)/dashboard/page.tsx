import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { getNotificationSummary } from "@/lib/notifications";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
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
  const now = new Date();
  const [year, month] = monthParam
    ? monthParam.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const monthStart = toDateStr(year, month, 1);
  const monthEnd = toDateStr(year, month, new Date(year, month, 0).getDate());

  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const prevMonthHref = `/dashboard?month=${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}`;
  const nextMonthHref = `/dashboard?month=${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}`;

  const supabase = await createClient();
  const todayStr = toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { count: productCount },
    { count: lowStockCount },
    { data: salesItems },
    { data: purchaseItems },
    { data: notes },
    { data: recentNotes },
    { data: company },
    { data: todaySales },
    { data: todayPurchases },
    notifications,
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("inventory").select("*", { count: "exact", head: true }).lte("quantity", 0),
    supabase
      .from("sales_order_items")
      .select(
        "quantity, unit_price, products(name, unit), sales_orders!inner(order_date, customers(name))"
      )
      .gte("sales_orders.order_date", monthStart)
      .lte("sales_orders.order_date", monthEnd),
    supabase
      .from("purchase_order_items")
      .select(
        "quantity, unit_cost, products(name, unit), purchase_orders!inner(purchase_date, suppliers(name))"
      )
      .gte("purchase_orders.purchase_date", monthStart)
      .lte("purchase_orders.purchase_date", monthEnd),
    supabase
      .from("calendar_notes")
      .select("note_date, content")
      .gte("note_date", monthStart)
      .lte("note_date", monthEnd),
    supabase
      .from("calendar_notes")
      .select("note_date, content")
      .order("note_date", { ascending: false })
      .limit(5),
    supabase.from("company_profile").select("name, logo_mark_url").eq("id", 1).maybeSingle(),
    supabase
      .from("sales_order_items")
      .select("quantity, unit_price, sales_orders!inner(order_date)")
      .eq("sales_orders.order_date", todayStr),
    supabase
      .from("purchase_order_items")
      .select("quantity, unit_cost, purchase_orders!inner(purchase_date)")
      .eq("purchase_orders.purchase_date", todayStr),
    user
      ? getNotificationSummary(supabase, user.id)
      : Promise.resolve({ announcements: [], todos: [] }),
  ]);

  const unreadAnnouncements = notifications.announcements;
  const overdueTodos = notifications.todos.filter((t) => t.due_date && t.due_date < todayStr);
  const dueSoonTodos = notifications.todos.filter((t) => !t.due_date || t.due_date >= todayStr);

  type ItemRow = {
    partnerName: string;
    productName: string;
    unit: string;
    quantity: number;
    amount: number;
  };

  type DayData = {
    salesCount: number;
    salesTotal: number;
    salesItems: ItemRow[];
    purchaseCount: number;
    purchaseTotal: number;
    purchaseItems: ItemRow[];
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
        note: "",
      };
    }
    return dataByDate[date];
  }

  for (const item of salesItems ?? []) {
    const date = item.sales_orders.order_date;
    const amount = item.quantity * Number(item.unit_price);
    const bucket = ensure(date);
    bucket.salesCount += 1;
    bucket.salesTotal += amount;
    bucket.salesItems.push({
      partnerName: item.sales_orders.customers?.name ?? "거래처 미상",
      productName: item.products?.name ?? "상품 미상",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      amount,
    });
  }

  for (const item of purchaseItems ?? []) {
    const date = item.purchase_orders.purchase_date;
    const amount = item.quantity * Number(item.unit_cost);
    const bucket = ensure(date);
    bucket.purchaseCount += 1;
    bucket.purchaseTotal += amount;
    bucket.purchaseItems.push({
      partnerName: item.purchase_orders.suppliers?.name ?? "공급처 미상",
      productName: item.products?.name ?? "상품 미상",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      amount,
    });
  }

  for (const note of notes ?? []) {
    ensure(note.note_date).note = note.content;
  }

  const weeks = buildWeeks(year, month);

  const todaySalesTotal = (todaySales ?? []).reduce(
    (sum, item) => sum + item.quantity * Number(item.unit_price),
    0
  );
  const todayPurchaseTotal = (todayPurchases ?? []).reduce(
    (sum, item) => sum + item.quantity * Number(item.unit_cost),
    0
  );

  const summaryRows = [
    { label: "오늘 매출", value: `${(todaySales ?? []).length}건 · ${todaySalesTotal.toLocaleString()}원` },
    { label: "오늘 매입", value: `${(todayPurchases ?? []).length}건 · ${todayPurchaseTotal.toLocaleString()}원` },
    { label: "전체 품목 수", value: `${productCount ?? 0}개` },
    { label: "안전재고 부족", value: `${lowStockCount ?? 0}건`, danger: (lowStockCount ?? 0) > 0 },
  ];

  const hasAlerts = unreadAnnouncements.length > 0 || overdueTodos.length > 0 || dueSoonTodos.length > 0;

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
          {overdueTodos.slice(0, 3).map((t) => (
            <Link key={`o-${t.id}`} href={`/todos/${t.id}`} className="erp-alert-item danger">
              <span className="erp-alert-tag danger">기한초과</span>
              {t.title} ({t.due_date})
            </Link>
          ))}
          {dueSoonTodos.slice(0, 3).map((t) => (
            <Link key={`d-${t.id}`} href={`/todos/${t.id}`} className="erp-alert-item">
              <span className="erp-alert-tag">할 일</span>
              {t.title}
              {t.due_date ? ` (${t.due_date})` : ""}
            </Link>
          ))}
        </div>
      )}
      <div className="erp-home">
      <div className="erp-home-panel">
        <div className="erp-home-panel-title">업무 요약</div>
        {summaryRows.map((row) => (
          <div className="erp-home-stat-row" key={row.label}>
            <span>{row.label}</span>
            <span
              className="erp-home-stat-value"
              style={row.danger ? { color: "var(--erp-danger)" } : undefined}
            >
              {row.value}
            </span>
          </div>
        ))}
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
        lowStockToday={(lowStockCount ?? 0) > 0}
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
            새 수주 등록
          </Link>
          <Link className="erp-home-list-item" href="/purchases">
            새 발주 등록
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
