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
  // 화면 자체가 "이 화면은 관리자만 볼 수 있습니다"로 통째로 막혀있는
  // 항목만 true로 표시한다 — 관리자가 아니면 클릭해도 벽만 보게 되므로
  // 메뉴/빠른검색/즐겨찾기에서 애초에 노출하지 않는다. 관리자 여부와
  // 무관하게 "보는 건 누구나, 바꾸는 건 관리자만"인 화면(예:
  // 결재매트릭스)은 실제로 볼 게 있으니 여기 표시하지 않는다.
  adminOnly?: boolean;
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
  // 공지사항/인사문서함/공문함/기안함의 최근 항목을 한 화면에 모아
  // 보여주는 훑어보기 전용 진입점 — 각 원본 화면(과 그 메뉴)은 그대로
  // 둔 채 새로 추가한다(전체 감사 후 사용자 요청으로 도입).
  { label: "게시판", items: [{ label: "게시판", href: "/board", flatLabel: "게시판" }] },
  { label: "매출관리", items: [{ label: "출고관리", href: "/sales", flatLabel: "매출관리" }] },
  {
    label: "매입관리",
    items: [
      { label: "입고관리", href: "/purchases", flatLabel: "매입관리" },
      { label: "구매요청", href: "/purchase-requests" },
      { label: "구매 견적요청", href: "/purchase-quote-requests" },
    ],
  },
  {
    label: "재고관리",
    items: [
      { label: "재고현황", href: "/inventory" },
      { label: "재고 실사", href: "/inventory/count" },
      { label: "QR 자동실사", href: "/inventory/count/scan" },
      { label: "QR 라벨 인쇄", href: "/inventory/qr-labels" },
      { label: "재고 부족 자동 발주 제안", href: "/inventory/reorder-suggestions" },
      { label: "창고 관리", href: "/inventory/warehouses" },
      { label: "창고 이동", href: "/inventory/transfers" },
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
  {
    label: "영업관리",
    items: [
      { label: "영업활동관리", href: "/sales-activities" },
      { label: "견적서관리", href: "/quotes" },
    ],
    featureKey: "crm",
  },
  {
    label: "전자결재",
    items: [
      { label: "기안함", href: "/approvals" },
      { label: "임시저장함", href: "/approvals/drafts" },
      { label: "공유 결재선", href: "/approvals/lines" },
      { label: "결재매트릭스", href: "/approvals/matrix" },
    ],
    featureKey: "approvals",
  },
  {
    // 전자결재(사내 기안)와 결재 인프라(결재선/전결권)는 그대로 재사용하되,
    // 회사 밖으로 나가는 공식 문서를 다루는 별도 모듈 — 전자결재 바로
    // 옆에 둔다.
    label: "공문관리",
    items: [
      { label: "내 공문함", href: "/official-documents" },
      { label: "받은 공문함", href: "/official-documents/received" },
    ],
    featureKey: "official_documents",
  },
  {
    label: "인사관리",
    items: [
      { label: "근태", href: "/hr/attendance" },
      { label: "연차관리", href: "/hr/leave-balances", adminOnly: true },
      { label: "급여 기준 설정", href: "/hr/payroll-settings", adminOnly: true },
      { label: "직원 급여정보", href: "/hr/employee-pay-settings", adminOnly: true },
      { label: "급여명세", href: "/hr/payroll", adminOnly: true },
      { label: "문서함", href: "/hr/documents" },
      { label: "문서 양식 관리", href: "/hr/documents/templates", adminOnly: true },
    ],
    featureKey: "hr",
  },
  { label: "공지사항", items: [{ label: "공지사항", href: "/announcements" }] },
  { label: "캘린더", items: [{ label: "캘린더", href: "/calendar", flatLabel: "캘린더" }] },
  {
    label: "메일함",
    items: [{ label: "메일함", href: "/mail", flatLabel: "메일함" }],
    featureKey: "mail",
  },
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
      { label: "부가세 신고 자료", href: "/reports/vat" },
      { label: "간이 손익계산서", href: "/reports/income-statement" },
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
      { label: "회사정보", href: "/settings/company", adminOnly: true },
      { label: "조직도 관리", href: "/settings/departments", adminOnly: true },
      { label: "전결권 관리", href: "/settings/delegations" },
      { label: "전자서명 등록", href: "/settings/signature" },
      { label: "메일 계정 연동", href: "/settings/mail" },
      { label: "기능 관리", href: "/settings/features", adminOnly: true },
      { label: "비밀번호 변경", href: "/settings/password" },
      { label: "운영자 문의", href: "/settings/support" },
      { label: "구독/결제", href: "/settings/billing", adminOnly: true },
    ],
  },
  {
    label: "시스템관리",
    items: [
      { label: "권한관리", href: "/settings/users", adminOnly: true },
      { label: "백업/복원", href: "/settings/backup", adminOnly: true },
      { label: "변경 이력", href: "/settings/audit-log", adminOnly: true },
    ],
  },
];

// 테넌트가 끈 기능(featureKey) 그룹 및 관리자 전용 항목(adminOnly, 일반
// 사용자에게는 안 보임)을 제외한 메뉴 목록. 트리메뉴/빠른검색/최근메뉴
// 전부 이 함수를 거친 결과만 써야, 꺼진 메뉴나 관리자 전용 화면이
// 어디서는 보이고 어디서는 안 보이는 불일치가 안 생긴다. 항목을
// 걸러내고 남은 게 없는 그룹(예: 전부 관리자 전용인 시스템관리)은
// 그룹째로 사라진다 — 눌러도 아무것도 없는 빈 그룹 헤더만 남는 걸
// 막는다.
// 그룹 전체(featureKey)뿐 아니라 세부 메뉴 항목 하나하나도 각자의 href를
// 키로 켜고 끌 수 있다(환경설정 > 기능 관리 화면에서 그누보드 관리자
// 페이지 수준으로 세분화한 요청 — 그룹 단위로만 끄던 걸 항목 단위까지
// 넓혔다). disabled_features 배열에는 그룹 featureKey와 leaf href가
// 같은 배열에 섞여 들어간다 — 서로 형태가 겹치지 않아(featureKey는
// "production" 같은 짧은 단어, href는 "/production"처럼 슬래시로
// 시작) 충돌하지 않는다.
export function getVisibleMenuGroups(disabledFeatures: string[], isAdmin: boolean): MenuGroup[] {
  return MENU_GROUPS.filter((g) => !g.featureKey || !disabledFeatures.includes(g.featureKey))
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => !disabledFeatures.includes(i.href) && (isAdmin || !i.adminOnly)
      ),
    }))
    .filter((g) => g.items.length > 0);
}

// 환경설정 > 기능 관리 화면 자기 자신은 꺼버리면 다시 켤 방법이
// 없어지므로(자물쇠 잠그고 열쇠도 같이 잠근 상태) 항목 단위 토글
// 목록에서 아예 빼서 항상 켜져 있게 한다.
export const MENU_TOGGLE_LOCKED_HREFS = new Set(["/settings/features", "/dashboard"]);

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

// 빠른검색처럼 "지금 이 사람이 실제로 들어갈 수 있는 메뉴"만 보여줘야
// 하는 곳에서 쓴다. 타이틀바 현재 위치 라벨(labelFor류)은 일부러 이
// 함수를 안 쓰고 전체 MENU_ITEMS를 그대로 쓴다 — 꺼진 기능/관리자 전용
// 페이지에 어쩌다 남아있는 링크로 들어가도 타이틀바 라벨 자체는 정상
// 표시돼야 한다.
export function getVisibleMenuItems(disabledFeatures: string[], isAdmin: boolean): MenuItem[] {
  return flatten(getVisibleMenuGroups(disabledFeatures, isAdmin));
}

export function findMenuItem(pathname: string): MenuItem | undefined {
  return findByLongestPrefix(MENU_ITEMS, pathname, (m) => m.href);
}
