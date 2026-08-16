export type FormState = { error?: string; success?: string } | undefined;

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.success) return null;

  return (
    <p
      className={`rounded-sm px-3 py-2 text-xs font-medium ${
        state.error
          ? "bg-[var(--erp-danger-bg)] text-[var(--erp-danger)]"
          : "bg-[var(--erp-success-bg)] text-[var(--erp-success)]"
      }`}
    >
      {state.error ?? state.success}
    </p>
  );
}
