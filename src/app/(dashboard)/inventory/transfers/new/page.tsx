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
    fetchAllRows<{ id: string; sku: string; name: string; spec: string | null }>((from, to) =>
      supabase.from("products").select("id, sku, name, spec").order("name").range(from, to)
    ),
  ]);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory/transfers" } }} />
      <ListPageHeader title="재고관리 > 창고 이동 > 등록" />

      {warehouses.length < 2 ? (
        <div className="erp-grid-empty" style={{ marginTop: 24 }}>
          창고가 2개 이상 있어야 이동을 등록할 수 있습니다.{" "}
          <Link href="/inventory/warehouses" style={{ color: "var(--erp-primary)", textDecoration: "underline" }}>
            창고 관리에서 창고를 추가하세요
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
