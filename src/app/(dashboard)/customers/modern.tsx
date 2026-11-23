import { withPageTiming } from "@/lib/page-timing";
import { PartyListScreen } from "@/components/grid/party-list-screen";

// 모던 테마(grid-modern) 전용 A형 거래처(출고처)관리 — 클래식은 classic.tsx(동결본). 화면 본문은 미수금·미지급금현황과 같은 공용 서버 화면(PartyListScreen)이다.
async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; limit?: string; id?: string }> }) {
  return <PartyListScreen kind="customer" mode="all" searchParams={searchParams} />;
}
export default withPageTiming("customers", CustomersPage);
