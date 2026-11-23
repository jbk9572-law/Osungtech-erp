import { PartyListScreen } from "@/components/grid/party-list-screen";

// 모던 테마(grid-modern) 전용 A형 공급처관리 — 클래식은 classic.tsx(동결본). 화면 본문은 미수금·미지급금현황과 같은 공용 서버 화면(PartyListScreen)이다.
export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ q?: string; limit?: string; id?: string }> }) {
  return <PartyListScreen kind="supplier" mode="all" searchParams={searchParams} />;
}
