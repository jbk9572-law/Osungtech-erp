import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { NewPurchaseRequestForm } from "@/components/new-purchase-request-form";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { todayKstStr } from "@/lib/kst-date";

export default async function NewPurchaseRequestPage() {
  const supabase = await createClient();

  const [suppliers, products] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("suppliers").select("id, name").order("name").range(from, to)
    ),
    fetchAllRows<{ id: string; sku: string; name: string; spec: string | null; price: number }>((from, to) =>
      supabase.from("products").select("id, sku, name, spec, price").order("name").range(from, to)
    ),
  ]);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/purchase-requests" } }} />
      <ListPageHeader title="매입관리 > 구매요청 > 작성" />

      <FormSection tabLabel="구매요청 작성">
        <NewPurchaseRequestForm today={todayKstStr()} suppliers={suppliers} products={products} />
      </FormSection>
    </div>
  );
}
