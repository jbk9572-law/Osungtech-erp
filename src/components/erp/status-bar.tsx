export function StatusBar({
  email,
  companyName,
}: {
  email: string | null;
  companyName?: string | null;
}) {
  const now = new Date().toLocaleDateString("ko-KR");

  return (
    <div className="erp-statusbar">
      <span>사용자: {email}</span>
      <span className="sep">|</span>
      <span>회사: {companyName || "오성테크"}</span>
      <span className="sep">|</span>
      <span>DB: 연결됨</span>
      <span className="sep">|</span>
      <span>서버: Production</span>
      <span className="sep">|</span>
      <span>{now}</span>
      <span style={{ marginLeft: "auto" }}>NEST ERP v1.0</span>
    </div>
  );
}
