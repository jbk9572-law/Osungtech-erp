import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { AccessWall } from "@/components/erp/access-wall";
import { PageGuide } from "@/components/erp/page-guide";
import { FeatureToggle } from "@/components/feature-toggle";
import { ClosingDateForm } from "@/components/closing-date-form";
import { setTenantFeatureEnabled } from "@/app/(dashboard)/settings/features/actions";
import { MENU_GROUPS, MENU_TOGGLE_LOCKED_HREFS, BEHAVIOR_FEATURE_KEYS, INDUSTRY_PRESETS } from "@/lib/erp-menu";

// 대메뉴 통폐합(20개 → 13개)으로 예전엔 자기 그룹을 가졌던 모듈(영업관리
// crm, 전자결재 approvals, 공문관리 official_documents)이 이제 다른
// 그룹 안의 항목 몇 개로 들어와 있다 — 그룹 헤더에 표시할 사람이 읽는
// 이름이 없어졌으므로 여기서 따로 라벨을 붙인다.
const FEATURE_KEY_LABELS: Record<string, string> = {
  crm: "영업관리(CRM)",
  approvals: "전자결재",
  official_documents: "공문관리",
};

export default async function FeatureSettingsPage() {
  const supabase = await createClient();
  const { isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return <AccessWall title="환경설정 > 기능 관리" message="이 화면은 관리자만 볼 수 있습니다." backHref="/dashboard" />;
  }

  // tenants_select_own RLS가 이미 "내 테넌트 한 행"으로만 걸러준다.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("disabled_features, closing_date, industry")
    .maybeSingle();
  const disabledFeatures = tenant?.disabled_features ?? [];
  // 업종 템플릿은 플랫폼 관리자만 바꿀 수 있다(헌법에 따라 테넌트
  // 관리자의 자유도는 아래 개별 토글에만 있고, 업종 자체는 여기서
  // 바꾸는 게 아니라 "왜 기본값이 이렇게 돼 있는지" 참고용으로만
  // 보여준다 — platform-admin/settings의 TenantIndustryForm 참고).
  const industryLabel = INDUSTRY_PRESETS.find((p) => p.key === tenant?.industry)?.label;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="환경설정 > 기능 관리" />

      <PageGuide>
        모든 회사가 모든 기능을 쓰지는 않으므로, 안 쓰는 메뉴는 그룹 전체 또는 세부 항목 단위로 꺼서
        왼쪽 메뉴에서 숨길 수 있습니다. 꺼도 데이터는 지워지지 않고, 언제든 다시 켤 수 있습니다.
        {industryLabel && (
          <>
            {" "}
            현재 업종 설정: <strong>{industryLabel}</strong>(플랫폼 관리자가 지정한 시작값입니다 — 아래
            토글은 이 설정과 상관없이 자유롭게 바꿀 수 있습니다).
          </>
        )}
      </PageGuide>

      {/* 메뉴 전체를 숨기는 위 토글과 달리, 기존 화면 안의 특정 필드/동작만
          업종에 따라 켜고 끄는 설정 — 범용 SaaS 확장 요청으로 추가됨
          (BEHAVIOR_FEATURE_KEYS, erp-menu.ts). 같은 FeatureToggle/
          setTenantFeatureEnabled를 재사용해서 토글 동작 자체는 위 메뉴
          토글과 완전히 동일하다. */}
      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">업종별 동작 설정</span>
        </div>
        <div className="erp-detail-body">
          <PageGuide>
            특정 업종에서만 쓰는 화면 안의 개별 기능입니다. 메뉴 자체는 그대로 보이고, 그 화면 안의
            해당 입력칸/동작만 켜고 끕니다.
          </PageGuide>
          <div className="flex flex-col gap-3">
            {BEHAVIOR_FEATURE_KEYS.map((f) => (
              <div
                key={f.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-sm p-3"
                style={{ border: "1px solid var(--erp-border)" }}
              >
                <div style={{ maxWidth: 640 }}>
                  <div className="text-sm font-bold" style={{ color: "var(--erp-text)" }}>
                    {f.label}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                    {f.description}
                  </div>
                </div>
                <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <FeatureToggle
                    featureKey={f.key}
                    label={f.label}
                    enabled={!disabledFeatures.includes(f.key)}
                    action={setTenantFeatureEnabled}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 운영자(staff)/관리자(admin) 권한 분리 — 범용 SaaS 확장 요청 2번
          (migration 207). 이 날짜(포함) 이전 거래일자의 매출/매입 전표는
          관리자만 수정/삭제할 수 있다. 비워서 저장하면 제한이 풀린다
          (기존 테넌트는 기본값 null이라 지금까지와 동일하게 동작). */}
      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">마감일 설정</span>
        </div>
        <div className="erp-detail-body">
          <PageGuide>
            이 날짜(포함) 이전 거래일자의 매출/매입 전표는 관리자만 수정·삭제할 수 있습니다. 일반
            직원(운영자)이 실수로 오래전 마감된 장부를 건드리는 걸 막기 위한 설정입니다. 비워두면
            제한 없이 지금까지와 동일하게 동작합니다.
          </PageGuide>
          <ClosingDateForm closingDate={tenant?.closing_date ?? null} />
        </div>
      </div>

      {MENU_GROUPS.map((group) => {
        // 이 그룹 안에 있는 항목들이 저마다 다른 featureKey(예: 매출관리
        // 안의 crm)를 들고 있을 수 있다 — 중복 없이 한 번씩만 토글로
        // 보여준다.
        const itemFeatureKeys = Array.from(
          new Set(group.items.map((i) => i.featureKey).filter((k): k is string => !!k))
        );
        return (
        <div className="erp-detail" key={group.label}>
          <div className="erp-detail-tabs" style={{ justifyContent: "space-between", paddingRight: 12, flexWrap: "wrap", rowGap: 6 }}>
            <span className="erp-detail-tab active">{group.label}</span>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {group.featureKey && (
                <FeatureToggle
                  featureKey={group.featureKey}
                  label={group.label}
                  enabled={!disabledFeatures.includes(group.featureKey)}
                  action={setTenantFeatureEnabled}
                />
              )}
              {itemFeatureKeys.map((fk) => (
                <FeatureToggle
                  key={fk}
                  featureKey={fk}
                  label={FEATURE_KEY_LABELS[fk] ?? fk}
                  enabled={!disabledFeatures.includes(fk)}
                  action={setTenantFeatureEnabled}
                />
              ))}
            </div>
          </div>
          <div className="erp-detail-body">
            <div className="erp-grid-wrap has-card-view">
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

            <div className="erp-row-card-list">
              {group.items.map((item) => (
                <div className="erp-row-card" key={item.href} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="erp-row-card-partner">{item.label}</span>
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
                </div>
              ))}
              {!group.items.length && <p className="erp-grid-empty">세부 메뉴가 없습니다.</p>}
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}
