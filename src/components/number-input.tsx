"use client";

function formatNumber(value: number): string {
  if (!Number.isFinite(value) || value === 0) return value === 0 ? "0" : "";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function parseNumber(raw: string): number {
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  allowNegative = false,
  disabled = false,
  className = "",
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  allowNegative?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      disabled={disabled}
      value={formatNumber(value)}
      onChange={(e) => {
        const raw = allowNegative
          ? e.target.value.replace(/[^0-9.,-]/g, "")
          : e.target.value.replace(/[^0-9.,]/g, "");
        onChange(parseNumber(raw));
      }}
      className={`text-right ${className}`}
    />
  );
}
