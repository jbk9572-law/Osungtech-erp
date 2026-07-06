export function combinePhone(formData: FormData): string | null {
  const parts = ["phone1", "phone2", "phone3"].map((key) =>
    String(formData.get(key) ?? "").trim()
  );
  const combined = parts.filter(Boolean).join("-");
  return combined || null;
}
