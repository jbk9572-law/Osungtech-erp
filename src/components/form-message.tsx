export type FormState = { error?: string; success?: string } | undefined;

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.success) return null;

  return (
    <p
      className="rounded-sm px-3 py-2 text-xs font-medium"
      style={
        state.error
          ? { background: "#fdeaec", color: "#dc3545" }
          : { background: "#e7f6ea", color: "#28a745" }
      }
    >
      {state.error ?? state.success}
    </p>
  );
}
