import { redirect } from "next/navigation";

// 재고 실사(입력)와 실사 이력(조회)이 서로 다른 메뉴로 나뉘어 있던 걸
// /inventory/count 한 화면으로 합쳤다 — 기존에 이 주소로 온 링크/즐겨찾기가
// 그대로 이어지도록 리다이렉트만 남겨둔다.
export default async function InventoryCountHistoryRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session } = await searchParams;
  redirect(session ? `/inventory/count?session=${encodeURIComponent(session)}` : "/inventory/count");
}
