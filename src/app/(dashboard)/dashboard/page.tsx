import { createClient } from "@/lib/supabase/server";
import { DashboardCalendar } from "@/components/dashboard-calendar";

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

  const [
    { count: productCount },
    { count: lowStockCount },
    { count: warehouseCount },
    { data: salesItems },
    { data: purchaseItems },
    { data: notes },
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("inventory").select("*", { count: "exact", head: true }).lte("quantity", 0),
    supabase.from("warehouses").select("*", { count: "exact", head: true }),
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
  ]);

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
  const todayStr = toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const monthSalesTotal = Object.values(dataByDate).reduce((sum, d) => sum + d.salesTotal, 0);
  const monthPurchaseTotal = Object.values(dataByDate).reduce((sum, d) => sum + d.purchaseTotal, 0);

  const stats = [
    { label: "전체 상품 수", value: productCount ?? 0 },
    { label: "재고 소진 항목", value: lowStockCount ?? 0 },
    { label: "창고 수", value: warehouseCount ?? 0 },
    { label: "이번달 매출", value: `${monthSalesTotal.toLocaleString()}원` },
    { label: "이번달 매입", value: `${monthPurchaseTotal.toLocaleString()}원` },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">대시보드</h1>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{stat.value}</p>
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
      />
    </div>
  );
}
