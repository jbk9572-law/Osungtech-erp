import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";
import { FeatureToggle } from "@/components/feature-toggle";
import { PlatformDefaultPlanSelect } from "@/components/platform-default-plan-select";
import { MaintenanceModeForm } from "@/components/maintenance-mode-form";
import { setPlatformDefaultFeatureEnabled } from "@/app/platform-admin/settings/actions";
import { MENU_GROUPS, MENU_TOGGLE_LOCKED_HREFS } from "@/lib/erp-menu";

export default async function PlatformSettingsPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: settings } = await supabase
    .from("platform_settings")
    .select("default_plan, default_disabled_features, maintenance_mode, maintenance_message")
    .eq("id", true)
    .maybeSingle();
  const defaultDisabledFeatures = settings?.default_disabled_features ?? [];

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">플랫폼 관리 &gt; 환경설정</h1>
      <PageGuide>
        여기서 정한 값은 새로 만들어지는 테넌트(고객사)에만 기본값으로 적용됩니다. 이미 만들어진
        회사의 설정은 각 회사의 환경설정 &gt; 기능 관리 화면에서 따로 바꿀 수 있습니다.
      </PageGuide>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 16 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">점검 모드</span>
        </div>
        <div className="erp-detail-body">
          <MaintenanceModeForm
            enabled={settings?.maintenance_mode ?? false}
            message={settings?.maintenance_message ?? null}
          />
        </div>
      </div>

      <div className="erp-detail" style={{ marginBottom: 16 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">기본 요금제</span>
        </div>
        <div className="erp-detail-body">
          <PlatformDefaultPlanSelect plan={settings?.default_plan ?? "trial"} />
        </div>
      </div>

      {MENU_GROUPS.map((group) => (
        <div className="erp-detail" key={group.label}>
          <div className="erp-detail-tabs" style={{ justifyContent: "space-between", paddingRight: 12 }}>
            <span className="erp-detail-tab active">{group.label}</span>
            {group.featureKey && (
              <FeatureToggle
                featureKey={group.featureKey}
                label={group.label}
                enabled={!defaultDisabledFeatures.includes(group.featureKey)}
                action={setPlatformDefaultFeatureEnabled}
              />
            )}
          </div>
          <div className="erp-detail-body">
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>세부 메뉴</th>
                    <th style={{ width: 140 }}>신규 테넌트 기본값</th>
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
                            enabled={!defaultDisabledFeatures.includes(item.href)}
                            action={setPlatformDefaultFeatureEnabled}
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
