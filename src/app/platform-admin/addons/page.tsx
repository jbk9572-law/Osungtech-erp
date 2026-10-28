import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";
import { ListPageHeader } from "@/components/erp/page-header";
import { CreateAddOnProductForm } from "@/components/create-addon-product-form";
import { AddOnProductRow } from "@/components/addon-product-row";

export default async function PlatformAddOnsPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: addons } = await supabase
    .from("add_on_products")
    .select("id, key, name, kind, capacity, monthly_price, is_active, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(200);

  return (
    <div>
      <ListPageHeader eyebrow="플랫폼 관리" title="애드온(추가 패키지)" />
      <PageGuide>
        기본 요금제의 제공량을 초과하는 고객사에 붙이는 추가 패키지 카탈로그입니다. 여기서 등록한
        애드온을 실제 고객사에 연결해 쿼터에 반영하는 기능과 결제 연동은 아직 없고, 지금은 상품 종류
        (이름·적용 유형·제공량·가격)만 코드 수정 없이 관리합니다.
      </PageGuide>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: "var(--erp-space-5)" }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">새 애드온 등록</span>
        </div>
        <div className="erp-detail-body">
          <CreateAddOnProductForm />
        </div>
      </div>

      {!addons?.length ? (
        <p className="erp-grid-empty">등록된 애드온이 없습니다.</p>
      ) : (
        <div className="erp-card-feed erp-card-feed-compact">
          {addons.map((a) => (
            <AddOnProductRow
              key={a.id}
              id={a.id}
              addonKey={a.key}
              name={a.name}
              kind={a.kind}
              capacity={a.capacity}
              monthlyPrice={a.monthly_price}
              isActive={a.is_active}
            />
          ))}
        </div>
      )}
    </div>
  );
}
