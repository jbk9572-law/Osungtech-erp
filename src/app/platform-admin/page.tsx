import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { FormSection } from "@/components/erp/page-header";
import { CreateCompanyForm } from "@/components/create-company-form";
import { TenantDetailPanel } from "@/components/tenant-detail-panel";
import { TenantListBody, type TenantRow } from "@/components/tenant-list-body";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { isPlanExpired } from "@/lib/tenant-plan";
import { isUuid } from "@/lib/is-uuid";
import { formatNumber } from "@/lib/format-number";
import type { BadgeTone } from "@/components/grid/badge";

const PLAN_LABELS: Record<string, string> = {
  trial: "체험",
  active: "정상 이용",
  suspended: "이용 중지",
};

type PlatformStats = {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  monthlySignups: { month: string; count: number }[];
};

// 타 업체(테넌트) 온보딩의 유일한 입구. 공개 회원가입 페이지가 없는
// 지금 구조상, 새 고객사는 이 화면에서 플랫폼 운영자가 직접 만들어준다
// — 오성테크도 여러 회사 중 하나(테넌트 #1)가 되는 구조로 바뀐 뒤의
// 후속 조치.
//
// 다른 그룹웨어 분할뷰 화면(공지사항 등)과 같은 .erp-split3-shell(상태
// 필터+목록+상세) 구조로 통일했다 — 예전엔 카드 목록 아래에 "상세"
// 링크로 별도 페이지(/platform-admin/[tenantId])를 새로 열었는데, 같은
// 플랫폼 관리자 안에서만 쓰는 화면끼리(공지사항·요금제는 이미 분할뷰
// 아니면 카드 목록) 느낌이 흩어져 있었다. 상세 내용 자체는
// TenantDetailPanel로 공용화해 [tenantId]/page.tsx(직접 링크/모바일
// 전체화면)와 여기서 똑같이 쓴다.
export default async function PlatformAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const selectedId = id && isUuid(id) ? id : undefined;

  // 권한 체크(로그인 안 됐거나 플랫폼 운영자가 아니면 리다이렉트)는
  // 상위 platform-admin/layout.tsx에서 이미 끝냈다 — 여기서는 supabase
  // 클라이언트만 받아 쓴다.
  const { supabase } = await requirePlatformAdmin();

  // 플랫폼 전체 고객사 수는 당분간 1000곳을 넘을 일이 없다(직접 영업
  // 기반 B2B ERP) — 넘어설 정도로 커지면 그때 fetchAllRows()로 바꾼다.
  //
  // 테넌트 목록은 평범한 .from("tenants").select(...)(RLS 경유) 대신
  // get_platform_tenant_list() RPC(SECURITY DEFINER, migration 199)로
  // 가져온다 — tenants_select_platform_admin RLS 정책이 permissive
  // OR로 전체를 보여줘야 하는데 실제로는 플랫폼 운영자 계정에도 자기
  // 테넌트 1개만 보이는 문제가 있었다. 바로 아래 KPI(get_platform_stats)도
  // 이미 같은 SECURITY DEFINER 방식이라, 이 화면 전체가 RLS 경로에
  // 의존하지 않도록 통일한다 — 어차피 requirePlatformAdmin()으로 이미
  // 한 번 막혀 있어 이중으로 안전하다.
  const [{ data: tenants }, { data: statsData }] = await Promise.all([
    supabase.rpc("get_platform_tenant_list"),
    supabase.rpc("get_platform_stats"),
  ]);
  const stats = statsData as PlatformStats | null;

  const rows: TenantRow[] = (tenants ?? []).map((t) => {
    const isExpired = isPlanExpired(t.plan_expires_at);
    let statusLabel: string;
    let statusTone: BadgeTone;
    if (t.plan === "suspended") {
      statusLabel = "이용 중지";
      statusTone = "danger";
    } else if (t.disabled_at) {
      statusLabel = "비활성";
      statusTone = "danger";
    } else if (isExpired) {
      statusLabel = "만료됨";
      statusTone = "warn";
    } else if (t.plan === "trial") {
      statusLabel = "체험 이용 중";
      statusTone = "warn";
    } else {
      statusLabel = "정상 이용 중";
      statusTone = "ok";
    }
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      planLabel: PLAN_LABELS[t.plan] ?? t.plan,
      createdAt: t.created_at,
      statusLabel,
      statusTone,
    };
  });

  const newHref = "/platform-admin";

  return (
    <div>
      {/* 다른 분할뷰 화면(공지사항/견적서 등)은 전부 F2(신규)+Esc(닫기)
          한 쌍으로 등록돼 있어서 힌트바가 "F2 신규 · Esc 닫기" 두 칸으로
          뜬다 — F2 없이 Esc만 등록했더니 힌트바가 항목 1개짜리로 혼자 떠
          보였던 걸 맞췄다(F2는 이미 기본값인 목록+새 회사 추가 화면으로,
          이미 거기 있을 땐 사실상 변화 없음 — 다른 화면의 F2도 이미 그
          화면이면 마찬가지). 거기에 더해, 힌트바 자체가 본문 맨 위에
          독립된 박스로 붕 떠서 제목과 안 어울린다는 지적을 받아
          hideHintBar로 기본 박스 렌더링은 끄고, 제목 줄 안에 같이 녹여
          넣는다(아래 h1 옆). */}
      <KeyboardShortcuts
        shortcuts={{ F2: { href: newHref }, Escape: { href: selectedId ? newHref : "/dashboard" } }}
        hideHintBar
      />
      {/* "플랫폼 관리 > 고객사"를 제목 문자열에 그대로 꿰매 넣던 걸
          (7개 화면이 전부 똑같은 패턴으로 복붙하고 있었다) ListPageHeader가
          이미 갖고 있던 eyebrow(.erp-eyebrow — 어디서도 안 쓰이고 있던
          기존 디자인 토큰)로 바꿨다. 이 화면만 F2/Esc 힌트가 제목 옆에
          나란히 와야 해서(위 주석) ListPageHeader를 그대로 쓰지 않고
          eyebrow 라벨만 떼어와 같은 모양을 손으로 맞춘다 — 다른 6개
          플랫폼 관리자 화면은 ListPageHeader를 그대로 쓴다. */}
      <span className="erp-eyebrow">플랫폼 관리</span>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="erp-h1">고객사</h1>
        <div
          className="flex items-center gap-3"
          style={{ fontSize: "var(--erp-font-sm)", color: "var(--erp-text-muted)", fontWeight: 600 }}
        >
          <span className="erp-key-hint">
            <kbd>F2</kbd>신규
          </span>
          <span className="erp-key-hint">
            <kbd>Esc</kbd>닫기
          </span>
        </div>
      </div>

      <div className="erp-kpi-row" style={{ marginBottom: "var(--erp-space-4)" }}>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">전체 테넌트</div>
          <div className="erp-kpi-value">{formatNumber(stats?.totalTenants ?? rows.length)}개</div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">활성 테넌트</div>
          <div className="erp-kpi-value" style={{ color: "var(--erp-primary)" }}>
            {formatNumber(stats?.activeTenants ?? rows.filter((r) => r.statusTone === "ok").length)}개
          </div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">전체 사용자</div>
          <div className="erp-kpi-value">{formatNumber(stats?.totalUsers ?? 0)}명</div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">이번 달 가입</div>
          <div className="erp-kpi-value" style={{ color: "var(--erp-success)" }}>
            {formatNumber(stats?.monthlySignups.at(-1)?.count ?? 0)}개
          </div>
        </div>
      </div>

      <div className="erp-split3-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <TenantListBody rows={rows} selectedId={selectedId} basePath={newHref} />

        <div className="erp-split-detail">
          {selectedId ? (
            <TenantDetailPanel tenantId={selectedId} closeHref={newHref} />
          ) : (
            <FormSection tabLabel="새 회사 추가">
              <CreateCompanyForm />
            </FormSection>
          )}
        </div>
      </div>
    </div>
  );
}
