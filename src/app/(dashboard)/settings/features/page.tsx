import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { FeatureToggle } from "@/components/feature-toggle";
import { setTenantFeatureEnabled } from "@/app/(dashboard)/settings/features/actions";
import { MENU_GROUPS, MENU_TOGGLE_LOCKED_HREFS } from "@/lib/erp-menu";

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
      <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">환경설정 &gt; 기능 관리</h1>

      <PageGuide>
        모든 회사가 모든 기능을 쓰지는 않으므로, 안 쓰는 메뉴는 그룹 전체 또는 세부 항목 단위로 꺼서
        왼쪽 메뉴에서 숨길 수 있습니다. 꺼도 데이터는 지워지지 않고, 언제든 다시 켤 수 있습니다.
      </PageGuide>

      {MENU_GROUPS.map((group) => (
        <div className="erp-detail" key={group.label}>
          <div className="erp-detail-tabs" style={{ justifyContent: "space-between", paddingRight: 12 }}>
            <span className="erp-detail-tab active">{group.label}</span>
            {group.featureKey && (
              <FeatureToggle
                featureKey={group.featureKey}
                label={group.label}
                enabled={!disabledFeatures.includes(group.featureKey)}
                action={setTenantFeatureEnabled}
              />
            )}
          </div>
          <div className="erp-detail-body">
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>세부 메뉴</th>
                    <th style={{ width: 140 }}>사용 여부</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.href}>
                      <td>{item.label}</td>
                      <td>
                        {MENU_TOGGLE_LOCKED_HREFS.has(item.href) ? (
                          <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
                            항상 사용
                          </span>
                        ) : (
                          <FeatureToggle
                            featureKey={item.href}
                            label={item.label}
                            enabled={!disabledFeatures.includes(item.href)}
                            action={setTenantFeatureEnabled}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
