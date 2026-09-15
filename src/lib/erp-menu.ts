import { findByLongestPrefix } from "@/lib/route-match";

// 실제로 존재하는 메뉴(라우트)의 단일 소스 — 트리메뉴/빠른검색/즐겨찾기/
// 최근메뉴가 전부 이 목록에서 파생된 걸 쓴다 (같은 프로그램처럼 보이려면
// 메뉴 소스가 하나여야 한다). 예전엔 트리메뉴가 이 목록과 별개로 자기
// 순서를 갖고 있어서(할일관리가 트리에서만 2번째였음) 서로 어긋났었다.
export type MenuLeaf = {
  label: string;
  href: string;
  // 빠른검색/즐겨찾기용 평평한 라벨이 "그룹 > 항목" 기계적 규칙과 다를 때만
  // 지정한다(예: "메인 대시보드 > 홈"이 아니라 그냥 "메인 대시보드").
  flatLabel?: string;
};
// featureKey가 있는 그룹만 테넌트별로 껐다 켰다 할 수 있다(SaaS 판매용
// 전환 — 회사마다 쓰는 기능이 다 다르니, 예를 들어 생산 안 하는 유통사는
// 생산관리를, 오성테크가 아닌 회사는 모조지 계산을 끌 수 있어야 한다).
// 없으면 모든 테넌트에서 항상 켜져 있는 핵심 기능으로 취급한다. 실제
// on/off 값은 DB(tenants.disabled_features, migration 104)에 저장되고,
// 이 배열은 "무엇을 토글할 수 있는가"라는 카탈로그 역할만 한다.
export type MenuGroup = { label: string; items: MenuLeaf[]; featureKey?: string };

export const MENU_GROUPS: MenuGroup[] = [
  { label: "메인 대시보드", items: [{ label: "홈", href: "/dashboard", flatLabel: "메인 대시보드" }] },
  { label: "매출관리", items: [{ label: "출고관리", href: "/sales", flatLabel: "매출관리" }] },
  { label: "매입관리", items: [{ label: "입고관리", href: "/purchases", flatLabel: "매입관리" }] },
  {
    label: "재고관리",
    items: [
      { label: "재고현황", href: "/inventory" },
      { label: "재고 실사", href: "/inventory/count" },
      { label: "QR 자동실사", href: "/inventory/count/scan" },
      { label: "QR 라벨 인쇄", href: "/inventory/qr-labels" },
      { label: "재고 부족 자동 발주 제안", href: "/inventory/reorder-suggestions" },
      { label: "관리번호 조회", href: "/inventory/lot-lookup" },
    ],
  },
  { label: "품목관리", items: [{ label: "품목관리", href: "/products" }] },
  {
    label: "생산관리",
    items: [{ label: "생산지시 내역", href: "/production" }],
    featureKey: "production",
  },
  {
    label: "거래처관리",
    items: [
      { label: "출고처관리", href: "/customers" },
      { label: "공급처관리", href: "/suppliers" },
      { label: "미수금현황", href: "/receivables" },
      { label: "미지급금현황", href: "/payables" },
    ],
  },
  { label: "할일관리", items: [{ label: "할일관리", href: "/todos" }] },
  { label: "전자결재", items: [{ label: "기안함", href: "/approvals" }], featureKey: "approvals" },
  {
    label: "인사관리",
    items: [
      { label: "근태", href: "/hr/attendance" },
      { label: "연차관리", href: "/hr/leave-balances" },
      { label: "급여 기준 설정", href: "/hr/payroll-settings" },
      { label: "직원 급여정보", href: "/hr/employee-pay-settings" },
      { label: "급여명세", href: "/hr/payroll" },
      { label: "문서함", href: "/hr/documents" },
      { label: "문서 양식 관리", href: "/hr/documents/templates" },
    ],
    featureKey: "hr",
  },
  { label: "공지사항", items: [{ label: "공지사항", href: "/announcements" }] },
  {
    // 성격이 같은 회계/집계 화면 2개(지급결의양식·월별 리포트)를 한
    // 그룹으로 모았다 — 예전엔 이 둘이 "보고서"/"확장모듈"에 각각 하나씩
    // 흩어져 있어서, 정작 확장모듈엔 계산 도구가 아닌 월별 리포트가
    // 섞여 있고 "보고서"는 항목이 1개뿐인 그룹으로 쪼개지는 어색함이
    // 있었다. 전표관리(매출/매입 주문을 그대로 다시 나열만 하던 화면)는
    // 매출관리/매입관리와 정보가 중복되고 독자적인 가치가 없어 삭제.
    label: "회계·보고서",
    items: [
      { label: "지급결의양식", href: "/reports/payment-requests" },
      { label: "월별 리포트", href: "/reports/monthly" },
      { label: "수불부", href: "/reports/ledger" },
    ],
  },
  {
    label: "확장모듈",
    items: [
      // findMenuItem이 가장 구체적인(긴) href를 우선하므로, 여기 순서는
      // 라우팅 정확성과 무관하게 순수히 화면 표시 우선순위로 정한다 —
      // 모조지 계산이 주 기능, 재단 배치 시뮬레이터는 그 안에서 이어지는
      // 하위 기능이라 뒤에 둔다.
      { label: "모조지 계산", href: "/paper-calc" },
      { label: "재단 배치 시뮬레이터", href: "/paper-calc/manual" },
    ],
    featureKey: "paper_calc",
  },
  {
    label: "환경설정",
    items: [
      { label: "회사정보", href: "/settings/company" },
      { label: "기능 관리", href: "/settings/features" },
      { label: "비밀번호 변경", href: "/settings/password" },
    ],
  },
  {
    label: "시스템관리",
    items: [
      { label: "권한관리", href: "/settings/users" },
      { label: "백업/복원", href: "/settings/backup" },
      { label: "변경 이력", href: "/settings/audit-log" },
    ],
  },
];

// 설정 화면(기능 관리)에 보여줄 카탈로그 — featureKey가 있는 그룹에서
// 그대로 뽑아낸다. 새 토글 가능 모듈을 추가할 땐 위 MENU_GROUPS에
// featureKey만 붙이면 여기 자동으로 나타난다(따로 목록을 관리할 필요
// 없음).
export type ToggleableFeature = { key: string; label: string };

export const TOGGLEABLE_FEATURES: ToggleableFeature[] = MENU_GROUPS.filter(
  (g): g is MenuGroup & { featureKey: string } => !!g.featureKey,
).map((g) => ({ key: g.featureKey, label: g.label }));

// 테넌트가 끈 기능(featureKey) 그룹을 제외한 메뉴 목록. 트리메뉴/빠른검색/
// 최근메뉴 전부 이 함수를 거친 결과만 써야, 꺼진 메뉴가 어디서는 보이고
// 어디서는 안 보이는 불일치가 안 생긴다.
export function getVisibleMenuGroups(disabledFeatures: string[]): MenuGroup[] {
  if (disabledFeatures.length === 0) return MENU_GROUPS;
  return MENU_GROUPS.filter((g) => !g.featureKey || !disabledFeatures.includes(g.featureKey));
}

export type MenuItem = { label: string; href: string };

function flatten(groups: MenuGroup[]): MenuItem[] {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      label: item.flatLabel ?? (group.items.length === 1 && group.label === item.label
        ? group.label
        : `${group.label} > ${item.label}`),
      href: item.href,
    }))
  );
}

export const MENU_ITEMS: MenuItem[] = flatten(MENU_GROUPS);

// 빠른검색처럼 "지금 이 회사에서 실제로 쓸 수 있는 메뉴"만 보여줘야 하는
// 곳에서 쓴다. 타이틀바 현재 위치 라벨(labelFor류)은 일부러 이 함수를
// 안 쓰고 전체 MENU_ITEMS를 그대로 쓴다 — 꺼진 기능 페이지에 어쩌다
// 남아있는 링크로 들어가도 타이틀바 라벨 자체는 정상 표시돼야 한다.
export function getVisibleMenuItems(disabledFeatures: string[]): MenuItem[] {
  if (disabledFeatures.length === 0) return MENU_ITEMS;
  return flatten(getVisibleMenuGroups(disabledFeatures));
}

export function findMenuItem(pathname: string): MenuItem | undefined {
  return findByLongestPrefix(MENU_ITEMS, pathname, (m) => m.href);
}
