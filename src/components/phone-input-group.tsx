import { splitPhone } from "@/lib/phone";

export function PhoneInputGroup({
  namePrefix,
  defaultValue,
}: {
  namePrefix: string;
  defaultValue?: string | null;
}) {
  const [part1, part2, part3] = splitPhone(defaultValue);

  return (
    <div className="flex items-center gap-1">
      <input
        name={`${namePrefix}1`}
        autoComplete="off"
        placeholder="010"
        aria-label="전화번호 앞자리"
        defaultValue={part1}
        maxLength={4}
        className="erp-input w-full min-w-0 text-center"
      />
      <span style={{ color: "var(--erp-text-muted)" }}>-</span>
      <input
        name={`${namePrefix}2`}
        autoComplete="off"
        placeholder="1234"
        aria-label="전화번호 가운데자리"
        defaultValue={part2}
        maxLength={4}
        className="erp-input w-full min-w-0 text-center"
      />
      <span style={{ color: "var(--erp-text-muted)" }}>-</span>
      <input
        name={`${namePrefix}3`}
        autoComplete="off"
        placeholder="5678"
        aria-label="전화번호 뒷자리"
        defaultValue={part3}
        maxLength={4}
        className="erp-input w-full min-w-0 text-center"
      />
    </div>
  );
}
