// 실제로 존재하는 메뉴(라우트) 목록 — 트리메뉴/빠른검색/즐겨찾기/최근메뉴가
// 전부 이 하나의 목록을 공유한다 (같은 프로그램처럼 보이려면 메뉴 소스가
// 하나여야 한다).
export type MenuItem = { label: string; href: string };

export const MENU_ITEMS: MenuItem[] = [
  { label: "메인 대시보드", href: "/dashboard" },
  { label: "영업관리 > 수주관리", href: "/sales" },
  { label: "구매관리 > 발주관리", href: "/purchases" },
  { label: "재고관리 > 재고현황", href: "/inventory" },
  { label: "품목관리", href: "/products" },
  { label: "거래처관리 > 판매처관리", href: "/customers" },
  { label: "거래처관리 > 공급처관리", href: "/suppliers" },
  { label: "환경설정 > 회사정보", href: "/settings/company" },
];

export function findMenuItem(pathname: string): MenuItem | undefined {
  return MENU_ITEMS.find((m) => pathname.startsWith(m.href));
}
