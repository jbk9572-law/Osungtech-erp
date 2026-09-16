// 품목 카테고리는 대시보드의 매입-매출 매칭 추적 여부(dashboard-calendar.tsx의
// isTrackedCategory)를 가르는 기준이기도 해서, 등록 화면에서 자유롭게 아무
// 이름이나 새로 만들 수 있게 두면 오타/변형("필터", "Filters" 등)이 생겨
// 그 매칭 로직이 조용히 어긋난다. 사용자가 확정한 이 6개로 고정한다.
export const PRODUCT_CATEGORIES = [
  "Paper",
  "Material",
  "Tray",
  "Bobbin",
  "Filter",
  "Etc",
] as const;
