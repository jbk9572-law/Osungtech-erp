import { signOut } from "@/app/login/actions";

export function ErpTopbar({
  companyName,
  logoUrl,
  email,
}: {
  companyName: string;
  logoUrl?: string | null;
  email: string | null;
}) {
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <header className="erp-topbar">
      <div className="erp-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl || "/branding/logo-mark.png"} alt="" />
        {companyName} ERP
      </div>
      <div className="erp-spacer" />
      <div className="erp-meta">
        <span>
          <b>{companyName}</b>
        </span>
        <span className="erp-divider" />
        <span>{today}</span>
        <span className="erp-divider" />
        <span>
          사용자 : <b>{email ?? "-"}</b>
        </span>
      </div>
      <form action={signOut}>
        <button type="submit" className="erp-topbar-btn" title="로그아웃">
          <svg className="erp-ic" viewBox="0 0 16 16">
            <path d="M6 2H3v12h3" />
            <path d="M7 8h7m0 0-2.5-2.5M14 8l-2.5 2.5" />
          </svg>
          로그아웃
        </button>
      </form>
    </header>
  );
}
