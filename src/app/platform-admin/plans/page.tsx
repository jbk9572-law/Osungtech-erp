import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";
import { CreatePlatformPlanForm } from "@/components/create-platform-plan-form";
import { PlatformPlanRow } from "@/components/platform-plan-row";

export default async function PlatformPlansPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: plans } = await supabase
    .from("platform_plans")
    .select("id, plan_key, name, monthly_price, description, is_active, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(200);

  return (
    <div>
      <h1 className="mb-1 erp-h1">플랫폼 관리 &gt; 요금제</h1>
      <PageGuide>
        영업/안내용 요금제 카탈로그입니다. 실제 결제 연동은 아직 없고, 회사별 이용 상태(체험/정상
        이용/이용 중지)는 고객사 상세 화면에서 별도로 관리합니다.
      </PageGuide>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: "var(--erp-space-5)" }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">새 요금제 등록</span>
        </div>
        <div className="erp-detail-body">
          <CreatePlatformPlanForm />
        </div>
      </div>

      {!plans?.length ? (
        <p className="erp-grid-empty">등록된 요금제가 없습니다.</p>
      ) : (
        <div className="erp-card-feed erp-card-feed-compact">
          {plans.map((p) => (
            <PlatformPlanRow
              key={p.id}
              id={p.id}
              planKey={p.plan_key}
              name={p.name}
              monthlyPrice={p.monthly_price}
              description={p.description}
              isActive={p.is_active}
            />
          ))}
        </div>
      )}
    </div>
  );
}
