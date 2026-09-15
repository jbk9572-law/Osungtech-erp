import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { PageGuide } from "@/components/erp/page-guide";
import { FeatureToggle } from "@/components/feature-toggle";
import { setTenantFeatureEnabled } from "@/app/(dashboard)/settings/features/actions";
import { TOGGLEABLE_FEATURES } from "@/lib/erp-menu";

export default async function FeatureSettingsPage() {
  const supabase = await createClient();
  const { isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">환경설정 &gt; 기능 관리</h1>
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          이 화면은 관리자만 볼 수 있습니다.
        </p>
      </div>
    );
  }

  // tenants_select_own RLS가 이미 "내 테넌트 한 행"으로만 걸러준다.
  const { data: tenant } = await supabase.from("tenants").select("disabled_features").maybeSingle();
  const disabledFeatures = tenant?.disabled_features ?? [];

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">환경설정 &gt; 기능 관리</h1>
        <CloseButton href="/dashboard" />
      </div>

      <PageGuide>
        모든 회사가 모든 기능을 쓰지는 않으므로, 안 쓰는 기능은 꺼서
        메뉴에서 숨길 수 있습니다. 꺼도 데이터는 지워지지 않고, 언제든
        다시 켤 수 있습니다.
      </PageGuide>

      {TOGGLEABLE_FEATURES.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
          지금은 켜고 끌 수 있는 기능이 없습니다.
        </p>
      ) : (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th>메뉴</th>
                <th style={{ width: 140 }}>사용 여부</th>
              </tr>
            </thead>
            <tbody>
              {TOGGLEABLE_FEATURES.map((f) => (
                <tr key={f.key}>
                  <td>{f.label}</td>
                  <td>
                    <FeatureToggle
                      featureKey={f.key}
                      enabled={!disabledFeatures.includes(f.key)}
                      action={setTenantFeatureEnabled}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
