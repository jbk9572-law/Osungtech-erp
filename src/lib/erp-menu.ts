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
export type MenuGroup = { label: string; items: MenuLeaf[] };

export const MENU_GROUPS: MenuGroup[] = [
  { label: "메인 대시보드", items: [{ label: "홈", href: "/dashboard", flatLabel: "메인 대시보드" }] },
  { label: "매출관리", items: [{ label: "출고관리", href: "/sales", flatLabel: "매출관리" }] },
  { label: "매입관리", items: [{ label: "입고관리", href: "/purchases", flatLabel: "매입관리" }] },
  { label: "재고관리", items: [{ label: "재고현황", href: "/inventory" }] },
  { label: "품목관리", items: [{ label: "품목관리", href: "/products" }] },
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
  { label: "공지사항", items: [{ label: "공지사항", href: "/announcements" }] },
  { label: "보고서", items: [{ label: "지급결의양식", href: "/reports/payment-requests" }] },
  { label: "회계관리", items: [{ label: "전표관리", href: "/accounting/vouchers" }] },
  {
    label: "확장모듈",
    items: [
      // findMenuItem이 가장 구체적인(긴) href를 우선하므로, 여기 순서는
      // 라우팅 정확성과 무관하게 순수히 화면 표시 우선순위로 정한다 —
      // 모조지 계산이 주 기능, 재단 배치 시뮬레이터는 그 안에서 이어지는
      // 하위 기능이라 뒤에 둔다.
      { label: "모조지 계산", href: "/paper-calc" },
      { label: "재단 배치 시뮬레이터", href: "/paper-calc/manual" },
      { label: "월별 리포트", href: "/reports/monthly" },
    ],
  },
  {
    label: "환경설정",
    items: [
      { label: "회사정보", href: "/settings/company" },
      { label: "비밀번호 변경", href: "/settings/password" },
    ],
  },
  { label: "시스템관리", items: [{ label: "권한관리", href: "/settings/users" }] },
];

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

export function findMenuItem(pathname: string): MenuItem | undefined {
  return findByLongestPrefix(MENU_ITEMS, pathname, (m) => m.href);
}
