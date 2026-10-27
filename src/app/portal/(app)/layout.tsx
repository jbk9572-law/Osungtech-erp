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

  const { data: identity, error: identityError } = await supabase.rpc("portal_identity");
  const me = identity?.[0];
  if (identityError || !me) {
    await supabase.auth.signOut();
    redirect(await portalHref("/login"));
  }
  const isSubcontractor = me.kind === "subcontractor";

  return (
    <div className="erp" style={{ minHeight: "100vh" }}>
      <header
        className="erp-titlebar"
        style={{ justifyContent: "space-between" }}
      >
        <div className="erp-titlebar-left">
          {/* 회사명(me.display_name)은 환경설정에서 자유롭게 입력하는
              값이라 길이가 정해져 있지 않다 — 내부 ErpShell의 타이틀바와
              같은 .erp-titlebar-name(말줄임표)을 그대로 써야 좁은 화면에서
              길어도 오른쪽 로그아웃 버튼이 .erp의 overflow-x:hidden에
              밀려 잘리지 않는다(154d1ba에서 고친 것과 같은 유형의 버그). */}
          <span className="erp-titlebar-name" style={{ fontWeight: 700 }}>{me.display_name}</span>
          <span style={{ fontSize: 11, opacity: 0.8, flexShrink: 0 }}>{isSubcontractor ? "업체 포털" : "거래처 포털"}</span>
        </div>
        <nav className="erp-titlebar-right" style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {isSubcontractor ? (
            <Link href={await portalHref("/assignments")} style={{ color: "var(--erp-on-primary)" }}>
              배정된 공정
            </Link>
          ) : (
            <>
              <Link href={await portalHref("/new")} style={{ color: "var(--erp-on-primary)" }}>
                발주하기
              </Link>
              <Link href={await portalHref("/orders")} style={{ color: "var(--erp-on-primary)" }}>
                주문내역
              </Link>
            </>
          )}
          <form action={portalLogout}>
            <button type="submit" style={{ color: "var(--erp-on-primary)" }}>
              로그아웃
            </button>
          </form>
        </nav>
      </header>
      <main style={{ padding: 20, maxWidth: 960, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
