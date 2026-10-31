import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { NewStockTransferForm } from "@/components/new-stock-transfer-form";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { todayKstStr } from "@/lib/kst-date";

export default async function NewStockTransferPage() {
  const supabase = await createClient();

  const [warehouses, products] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("warehouses").select("id, name").order("created_at").range(from, to)
    ),
    // 파생 SKU(parent_product_id가 있는 품목)는 독립 재고가 없어 창고이동
    // 대상이 될 수 없다 — create_stock_transfer_with_items가 모품목 해석
    // 없이 입력받은 product_id 그대로 재고를 옮기므로, 파생 SKU를 고르면
    // 실제로는 재고가 없는 그 SKU 자체에 유령 재고가 생긴다. 선택지에서
    // 제외한다(매입 등록 화면과 같은 이유).
    fetchAllRows<{ id: string; sku: string; name: string; spec: string | null }>((from, to) =>
      supabase.from("products").select("id, sku, name, spec").is("parent_product_id", null).order("name").range(from, to)
    ),
  ]);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory/warehouses" } }} />
      <ListPageHeader title="재고관리 > 창고 > 이동 등록" />

      {warehouses.length < 2 ? (
        <div className="erp-grid-empty" style={{ marginTop: 24 }}>
          창고가 2개 이상 있어야 이동을 등록할 수 있습니다.{" "}
          <Link href="/inventory/warehouses" style={{ color: "var(--erp-primary)", textDecoration: "underline" }}>
            창고 목록에서 창고를 추가하세요
          </Link>
          .
        </div>
      ) : (
        <FormSection tabLabel="창고 이동 등록">
          <NewStockTransferForm today={todayKstStr()} warehouses={warehouses} products={products} />
        </FormSection>
      )}
    </div>
  );
}
