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
  // 독립된 트리메뉴/빠른검색/즐겨찾기 진입점으로 노출할 필요가 없는
  // 화면에 표시한다(예: 창고 이동 이력 — 이제 "창고" 화면 안에서 같이
  // 보여준다). adminOnly와 달리 권한과 무관하게 항상 숨긴다. 다만
  // MENU_ITEMS(타이틀바 현재 위치 라벨, 최근메뉴 기록)에는 그대로
  // 남겨둔다 — 안 그러면 그 화면에 들어갔을 때 타이틀바가 더 짧은
  // prefix(예: "/inventory")로 잘못 매칭돼 엉뚱한 라벨을 보여준다.
  hidden?: boolean;
  // 그룹 단위 featureKey(아래)와 별개로, 한 항목만 테넌트별로 껐다 켤 수
  // 있게 한다. 대메뉴 통폐합(20개 → 13개)으로 예전엔 자기 featureKey를
  // 가진 독립 그룹이었던 화면(예: 영업관리 crm, 공문관리
  // official_documents)이 이제 항상 켜져 있는 다른 그룹(매출관리 등)
  // 안의 항목 몇 개로 들어와 있어서, 그 항목들만 따로 끌 수 있어야
  // 그룹 전체를 껐다 켰다 하던 기존 기능이 안 없어진다.
  featureKey?: string;
};
// featureKey가 있는 그룹만 테넌트별로 껐다 켰다 할 수 있다(SaaS 판매용
// 전환 — 회사마다 쓰는 기능이 다 다르니, 예를 들어 생산 안 하는 유통사는
// 생산관리를, 오성테크가 아닌 회사는 모조지 계산을 끌 수 있어야 한다).
// 없으면 모든 테넌트에서 항상 켜져 있는 핵심 기능으로 취급한다. 실제
// on/off 값은 DB(tenants.disabled_features, migration 104)에 저장되고,
// 이 배열은 "무엇을 토글할 수 있는가"라는 카탈로그 역할만 한다.
export type MenuGroup = { label: string; items: MenuLeaf[]; featureKey?: string };

// 20개였던 대메뉴를 13개로 통폐합했다(사용자 지적: "메뉴가 너무 많다,
// 상단 가로 메뉴바로 옮기는 것도 검토했지만 13개도 한 줄에 거의 꽉 차서
// 오히려 가로 넘침 문제가 생겨 트리메뉴는 그대로 두고 통폐합만 하기로
// 결정함"). 화면/라우트/서버 액션/RLS는 전부 그대로 두고, "어느 대메뉴
// 밑에 뜨는가"만 재배치했다 — 기능을 없앤 게 아니라 정리한 것.
//   - 거래처관리 → 매출관리(출고처/미수금)·매입관리(공급처/미지급금)로
//     쪼개서 흡수: 파는 것 관련은 매출관리, 사는 것 관련은 매입관리로.
//   - 영업관리(crm) → 매출관리로 흡수. 영업활동관리/견적서관리는
//     featureKey를 그룹이 아니라 항목 단위로 옮겨 달아서, 이 두 화면만
//     따로 켜고 끄던 기존 동작을 그대로 유지한다.
//   - 품목관리 → 재고관리로 흡수(품목마스터도 결국 재고 기준정보).
//   - 전자결재 + 공문관리 → "결재/문서"로 통합(공문관리가 이미 전자결재의
//     결재선/전결권 인프라를 재사용하고 있어 논리적으로도 한 묶음).
//     각각 approvals/official_documents featureKey를 항목 단위로 유지.
//   - 캘린더 + 할일관리 → "일정관리"로 통합.
//   - 시스템관리 → 환경설정으로 흡수(이미 전부 adminOnly라 위화감 없음).
//   - 공지사항 → 게시판으로 흡수(게시판이 이미 공지사항을 모아 보여주고
//     있어서 단독 메뉴가 사실상 중복이었다).
//   - 게시판/메일함/결재·문서 → "그룹웨어"로 재통합(판매용 SaaS 전환
//     시점에 커뮤니케이션·문서 관련 화면이 메뉴 여기저기(독립 그룹,
//     인사관리 하위 등)에 흩어져 있어 한 묶음처럼 안 보인다는 지적).
//     인사관리에 있던 문서함(사내 서식 발급)도 "문서"라는 성격이 같아
//     같이 옮겼다 — 근태/연차/급여만 남아도 인사관리는 여전히 온전한
//     묶음이다. 화면/라우트/서버 액션/RLS는 전혀 안 바꿨고 메뉴 배치만
//     바꿨다.
export const MENU_GROUPS: MenuGroup[] = [
  { label: "메인 대시보드", items: [{ label: "홈", href: "/dashboard", flatLabel: "메인 대시보드" }] },
  {
    label: "그룹웨어",
    items: [
      { label: "게시판", href: "/board", flatLabel: "게시판" },
      { label: "공지사항", href: "/announcements" },
      { label: "메일함", href: "/mail", featureKey: "mail" },
      { label: "문서함", href: "/hr/documents" },
      { label: "문서 양식 관리", href: "/hr/documents/templates", adminOnly: true },
      { label: "기안함", href: "/approvals", featureKey: "approvals" },
      { label: "임시저장함", href: "/approvals/drafts", featureKey: "approvals" },
      { label: "공유 결재선", href: "/approvals/lines", featureKey: "approvals" },
      { label: "결재매트릭스", href: "/approvals/matrix", featureKey: "approvals" },
      // 전자결재(사내 기안)와 결재 인프라(결재선/전결권)는 그대로
      // 재사용하되, 회사 밖으로 나가는 공식 문서를 다루는 별도 모듈이라
      // featureKey는 따로 유지한다.
      { label: "내 공문함", href: "/official-documents", featureKey: "official_documents" },
      { label: "받은 공문함", href: "/official-documents/received", featureKey: "official_documents" },
    ],
  },
  {
    label: "매출관리",
    items: [
      { label: "출고관리", href: "/sales" },
      { label: "출고처관리", href: "/customers" },
      { label: "미수금현황", href: "/receivables" },
      { label: "영업활동관리", href: "/sales-activities", featureKey: "crm" },
      { label: "견적서관리", href: "/quotes", featureKey: "crm" },
    ],
  },
  {
    label: "매입관리",
    items: [
      { label: "입고관리", href: "/purchases" },
      { label: "구매요청", href: "/purchase-requests" },
      { label: "구매 견적요청", href: "/purchase-quote-requests" },
      { label: "공급처관리", href: "/suppliers" },
      { label: "미지급금현황", href: "/payables" },
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
      // 창고 관리(마스터)와 창고 이동(거래 이력)은 원래 메뉴 항목이
      // 따로 있었는데, 사용자가 "두 화면이 단절돼 보인다"고 지적해서
      // 화면 하나("창고")로 묶었다. 데이터/서버 액션/RLS는 그대로 완전히
      // 분리돼 있다 — 합친 건 진입점(메뉴)과 화면(창고 목록 아래에 창고
      // 이동 이력을 같이 보여줌)뿐이다.
      { label: "창고", href: "/inventory/warehouses" },
      { label: "창고 이동 이력", href: "/inventory/transfers", hidden: true },
      // 다른 소메뉴들과 달리 "관리번호 하나로 찾아보는" 보조 유틸리티라
      // 소메뉴에 혼자 덩그러니 있는 게 어색하다는 지적으로, 재고현황
      // 화면(가장 자연스러운 진입점) 툴바에 링크로 옮기고 트리메뉴/
      // 빠른검색에서는 숨겼다.
      { label: "관리번호 조회", href: "/inventory/lot-lookup", hidden: true },
      { label: "품목관리", href: "/products" },
    ],
  },
  {
    label: "생산관리",
    items: [{ label: "생산지시 내역", href: "/production" }],
    featureKey: "production",
  },
  {
    label: "인사관리",
    items: [
      { label: "근태", href: "/hr/attendance" },
      { label: "연차관리", href: "/hr/leave-balances", adminOnly: true },
      // 급여 기준 설정/직원 급여정보/급여명세는 원래 메뉴 항목이 따로
      // 있었는데, 서로 참조하며 쓰는 하나의 급여 처리 흐름이라("급여
      // 기준을 먼저 등록해주세요" 식으로 actions.ts가 이미 서로를
      // 언급하고 있었다) 화면 하나("급여관리")로 합쳤다.
      { label: "급여관리", href: "/hr/payroll", adminOnly: true },
    ],
    featureKey: "hr",
  },
  {
    label: "일정관리",
    items: [
      { label: "캘린더", href: "/calendar" },
      { label: "할일관리", href: "/todos" },
    ],
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
        (i) =>
          !disabledFeatures.includes(i.href) &&
          (isAdmin || !i.adminOnly) &&
          !i.hidden &&
          (!i.featureKey || !disabledFeatures.includes(i.featureKey))
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
