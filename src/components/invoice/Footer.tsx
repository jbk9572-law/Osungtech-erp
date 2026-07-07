import { FOOTER } from "./InvoiceMetrics";
import type { Company } from "./types";

// 0707 원본 하단: 인사말 + "From. ☎ 전화 Fax 팩스 이메일"
export function Footer({ company }: { company: Company }) {
  return (
    <div
      className="flex w-full justify-between opacity-90"
      style={{ paddingLeft: FOOTER.paddingX, paddingRight: FOOTER.paddingX, paddingTop: FOOTER.paddingTop, fontSize: FOOTER.fontSize }}
    >
      <span>{company?.greeting_message || ""}</span>
      <span>
        From. ☎ {company?.phone ?? "-"} Fax {company?.fax_number ?? "-"}
        {company?.email ? ` ${company.email}` : ""}
      </span>
    </div>
  );
}
