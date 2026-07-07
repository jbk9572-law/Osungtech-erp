import type { Company } from "./types";

export function Footer({ company }: { company: Company }) {
  return (
    <div className="flex w-full justify-between px-[4px] pt-[3px] text-[12px] opacity-90">
      <span>{company?.greeting_message || ""}</span>
      <span>
        From. ☎ {company?.phone ?? "-"} Fax {company?.fax_number ?? "-"}
        {company?.email ? ` ${company.email}` : ""}
      </span>
    </div>
  );
}
