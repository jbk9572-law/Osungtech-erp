import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";
import { ListPageHeader } from "@/components/erp/page-header";
import { FeatureToggle } from "@/components/feature-toggle";
import { PlatformDefaultPlanSelect } from "@/components/platform-default-plan-select";
import { MaintenanceModeForm } from "@/components/maintenance-mode-form";
import { TenantThemeForm } from "@/components/tenant-theme-form";
import { TenantIndustryForm } from "@/components/tenant-industry-form";
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

  const { data: tenantRows } = await supabase.rpc("get_platform_tenant_list");
  const tenants = (tenantRows ?? [])
    .map((t) => ({ id: t.id, name: t.name, theme: t.theme, industry: t.industry }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <div>
      <ListPageHeader eyebrow="플랫폼 관리" title="환경설정" />
      <PageGuide>
        여기서 정한 값은 새로 만들어지는 테넌트(고객사)에만 기본값으로 적용됩니다. 이미 만들어진
        회사의 설정은 각 회사의 환경설정 &gt; 기능 관리 화면에서 따로 바꿀 수 있습니다.
      </PageGuide>

      <div className="erp-detail erp-u-mt-0 erp-u-mb-s5">
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

      <div className="erp-detail erp-u-mb-s5">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">기본 요금제</span>
        </div>
        <div className="erp-detail-body">
          <PlatformDefaultPlanSelect plan={settings?.default_plan ?? "trial"} />
        </div>
      </div>

      <div className="erp-detail erp-u-mb-s5">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">화면 테마</span>
        </div>
        <div className="erp-detail-body">
          <PageGuide className="mb-2">
            회사(테넌트)를 고르고 테마를 선택한 뒤 적용을 누르면, 그 회사 직원이 보는 화면 전체(대시보드/
            매입/매출/메신저/게시판 등)에 바로 반영됩니다 — 회사마다 다른 테마를 줄 수 있습니다.
          </PageGuide>
          <TenantThemeForm tenants={tenants} />
        </div>
      </div>

      <div className="erp-detail erp-u-mb-s5">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">업종 템플릿</span>
        </div>
        <div className="erp-detail-body">
          <PageGuide className="mb-2">
            회사(테넌트)를 고르고 업종을 선택한 뒤 적용을 누르면, 그 업종에 보통 안 쓰는 메뉴들을
            한 번에 꺼줍니다 — 신규 고객사를 받을 때 아래 메뉴 토글을 하나하나 손으로 끌 필요가
            없어집니다. 적용은 시작값을 한 번 세팅해주는 것뿐이라, 그 뒤로 그 회사 관리자는
            환경설정 &gt; 기능 관리에서 개별 메뉴를 지금처럼 자유롭게 다시 켜고 끌 수 있습니다.
          </PageGuide>
          <TenantIndustryForm tenants={tenants} />
        </div>
      </div>

      {MENU_GROUPS.map((group) => (
        <div className="erp-detail" key={group.label}>
          <div className="erp-detail-tabs erp-u-justify-between" style={{ paddingRight: "var(--erp-space-4)" }}>
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
            <div className="erp-grid-wrap has-card-view">
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
                          <span className="text-xs erp-u-muted">
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

            <div className="erp-row-card-list">
              {group.items.map((item) => (
                <div className="erp-row-card erp-u-items-center erp-u-justify-between" key={item.href} style={{ flexDirection: "row" }}>
                  <span className="erp-row-card-partner">{item.label}</span>
                  {MENU_TOGGLE_LOCKED_HREFS.has(item.href) ? (
                    <span className="text-xs erp-u-muted">
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
                </div>
              ))}
              {!group.items.length && <p className="erp-grid-empty">세부 메뉴가 없습니다.</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
