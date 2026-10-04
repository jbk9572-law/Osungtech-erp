import { createClient } from "@/lib/supabase/server";
import { PortalNewOrderForm } from "@/components/portal-new-order-form";

export default async function PortalNewOrderPage() {
  const supabase = await createClient();
  const { data: catalog, error } = await supabase.rpc("portal_list_catalog");

  return (
    <div>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>발주하기</h1>
      {error ? (
        <p style={{ fontSize: 13, color: "var(--erp-danger)" }}>품목을 불러오지 못했습니다. 다시 시도해주세요.</p>
      ) : (
        <PortalNewOrderForm catalog={catalog ?? []} />
      )}
    </div>
  );
}
