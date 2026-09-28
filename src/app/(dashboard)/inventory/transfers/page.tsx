import { redirect } from "next/navigation";

// 창고 이동 이력 목록은 /inventory/warehouses 화면(창고 목록 바로 아래)으로
// 합쳐졌다 — 등록(/new)/상세([id])는 그대로 이 경로 밑에 남아있고, 목록
// 라우트 자체만 리다이렉트로 남겨서 기존 북마크/링크가 깨지지 않게 한다.
export default function StockTransfersPage() {
  redirect("/inventory/warehouses");
}
