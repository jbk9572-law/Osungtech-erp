import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { NewQuoteForm } from "@/components/new-quote-form";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { todayKstStr } from "@/lib/kst-date";

export default async function NewQuotePage() {
  const supabase = await createClient();

  const [customers, products] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("customers").select("id, name").order("name").range(from, to)
    ),
    fetchAllRows<{ id: string; sku: string; name: string; spec: string | null; price: number }>((from, to) =>
      supabase.from("products").select("id, sku, name, spec, price").order("name").range(from, to)
    ),
  ]);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/quotes" } }} />
      <ListPageHeader title="견적서관리 > 견적서 작성" />

      <FormSection tabLabel="견적서 작성">
        <NewQuoteForm today={todayKstStr()} customers={customers} products={products} />
      </FormSection>
    </div>
  );
}
