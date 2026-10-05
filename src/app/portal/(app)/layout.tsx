import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { portalLogout } from "@/app/portal/login/actions";
import { portalHref } from "@/lib/portal-path";

// 내부 대시보드의 ErpShell(타이틀바+트리메뉴)과는 완전히 다른, 훨씬 가벼운
// 포털 전용 셸이다 — 메뉴가 "발주하기"/"주문내역" 둘뿐이라 트리메뉴가
// 필요 없고, 거래처 담당자가 쓰는 화면이라 내부 직원 전용 요소(알림종,
// 메신저, 설정 메뉴 등)를 아예 안 보여주는 편이 맞다.
export default async function PortalAppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    redirect(await portalHref("/login"));
  }

  const { data: whoami, error: whoamiError } = await supabase.rpc("portal_whoami");
  const me = whoami?.[0];
  if (whoamiError || !me) {
    await supabase.auth.signOut();
    redirect(await portalHref("/login"));
  }

  return (
    <div className="erp" style={{ minHeight: "100vh" }}>
      <header
        className="erp-titlebar"
        style={{ justifyContent: "space-between" }}
      >
        <div className="erp-titlebar-left">
          <span style={{ fontWeight: 700 }}>{me.customer_name}</span>
          <span style={{ fontSize: 11, opacity: 0.8 }}>거래처 포털</span>
        </div>
        <nav className="erp-titlebar-right" style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Link href={await portalHref("/new")} style={{ color: "#fff" }}>
            발주하기
          </Link>
          <Link href={await portalHref("/orders")} style={{ color: "#fff" }}>
            주문내역
          </Link>
          <form action={portalLogout}>
            <button type="submit" style={{ color: "#fff" }}>
              로그아웃
            </button>
          </form>
        </nav>
      </header>
      <main style={{ padding: 20, maxWidth: 960, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
