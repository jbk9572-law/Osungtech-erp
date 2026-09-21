import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { NewPurchaseRequestForm } from "@/components/new-purchase-request-form";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { todayKstStr } from "@/lib/kst-date";

export default async function NewPurchaseRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier_id?: string; reorder_items?: string }>;
}) {
  const { supplier_id: prefillSupplierId, reorder_items: reorderItemsRaw } = await searchParams;
  // 재고 부족 자동 발주 제안(/inventory/reorder-suggestions)의 "구매요청
  // 작성으로 보내기"에서만 넘어온다(new-purchase-form.tsx의 reorder_items
  // 프리필과 동일한 패턴) — 값이 잘못돼도 등록 자체는 막지 않고 빈 폼으로 시작한다.
  let prefillItems: { productId: string; quantity: number }[] | undefined;
  if (reorderItemsRaw) {
    try {
      const parsed = JSON.parse(reorderItemsRaw);
      if (Array.isArray(parsed)) {
        prefillItems = parsed.filter(
          (item): item is { productId: string; quantity: number } =>
            typeof item?.productId === "string" && typeof item?.quantity === "number",
        );
      }
    } catch {
      // 무시: 프리필은 부가 기능이라 실패해도 등록 자체는 그대로 진행한다.
    }
  }

  const supabase = await createClient();

  const [suppliers, products] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("suppliers").select("id, name").order("name").range(from, to)
    ),
    // 구매(매입) 문맥이라 판매단가(price)가 아니라 매입원가(cost)를
    // 기본 예상단가로 쓴다 — new-purchase-form.tsx와 동일한 기준.
    fetchAllRows<{ id: string; sku: string; name: string; spec: string | null; cost: number }>((from, to) =>
      supabase.from("products").select("id, sku, name, spec, cost").order("name").range(from, to)
    ),
  ]);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/purchase-requests" } }} />
      <ListPageHeader title="매입관리 > 구매요청 > 작성" />

      <FormSection tabLabel="구매요청 작성">
        <NewPurchaseRequestForm
          today={todayKstStr()}
          suppliers={suppliers}
          products={products}
          prefillSupplierId={prefillSupplierId}
          prefillItems={prefillItems}
        />
      </FormSection>
    </div>
  );
}
