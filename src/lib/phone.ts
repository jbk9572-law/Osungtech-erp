export function combinePhone(formData: FormData, prefix = "phone"): string | null {
  const parts = ["1", "2", "3"].map((suffix) => String(formData.get(`${prefix}${suffix}`) ?? "").trim());
  const combined = parts.filter(Boolean).join("-");
  return combined || null;
}

export function splitPhone(phone?: string | null): [string, string, string] {
  const parts = (phone ?? "").split("-");
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
}
