import { formatKstDate } from "@/lib/kst-date";
import { GridSelectionStats } from "@/components/erp/grid-selection-stats";
export function StatusBar({
  email,
  companyName,
}: {
  email: string | null;
  companyName?: string | null;
}) {
  const now = formatKstDate();

  return (
    <div className="erp-statusbar">
      <span>사용자: {email}</span>
      <span className="sep">|</span>
      <span>회사: {companyName || "회사명 미설정"}</span>
      <span className="sep">|</span>
      <span>{now}</span>
      <GridSelectionStats />
      <span style={{ marginLeft: "auto" }}>ELVONIX v1.0</span>
    </div>
  );
}
