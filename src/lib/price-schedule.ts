import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 오늘(effective_date <= 오늘) 도래한 예약 단가를 customer_product_prices에
// 반영한다. 별도 배치/크론 없이, 가격을 조회하는 화면(거래처 상세, 판매
// 등록)에 들어올 때마다 이 함수를 먼저 호출해서 "그 시점 기준으로 이미
// 지난 예약은 항상 반영돼 있게" 만든다 — 서버가 그날 하필 안 켜져 있어도
// 다음에 누가 화면을 열기만 하면 그때 적용되므로 놓칠 일이 없다.
// 같은 거래처+상품에 예약이 여러 개 겹쳐도 effective_date가 가장 늦은
// 것부터 순서대로 적용해서 최종적으로는 제일 최근 예약값이 남는다.
export async function applyDuePriceSchedules(supabase: SupabaseServerClient, customerId?: string) {
  const today = new Date().toLocaleDateString("sv-SE");

  let query = supabase
    .from("price_change_schedules")
    .select("id, customer_id, product_id, new_unit_price, effective_date")
    .is("applied_at", null)
    .lte("effective_date", today)
    .order("effective_date", { ascending: true });

  if (customerId) query = query.eq("customer_id", customerId);

  const { data: due } = await query;
  if (!due || due.length === 0) return;

  for (const schedule of due) {
    await supabase.from("customer_product_prices").upsert(
      {
        customer_id: schedule.customer_id,
        product_id: schedule.product_id,
        unit_price: schedule.new_unit_price,
      },
      { onConflict: "customer_id,product_id" }
    );
  }

  await supabase
    .from("price_change_schedules")
    .update({ applied_at: new Date().toISOString() })
    .in(
      "id",
      due.map((s) => s.id)
    );
}
