import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: productCount }, { count: lowStockCount }, { count: warehouseCount }] =
    await Promise.all([
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase
        .from("inventory")
        .select("*", { count: "exact", head: true })
        .lte("quantity", 0),
      supabase.from("warehouses").select("*", { count: "exact", head: true }),
    ]);

  const stats = [
    { label: "전체 상품 수", value: productCount ?? 0 },
    { label: "재고 소진 항목", value: lowStockCount ?? 0 },
    { label: "창고 수", value: warehouseCount ?? 0 },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">대시보드</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
