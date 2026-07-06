export type FormState = { error?: string; success?: string } | undefined;

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.success) return null;

  return (
    <p
      className={`rounded-md px-3 py-2 text-sm ${
        state.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
      }`}
    >
      {state.error ?? state.success}
    </p>
  );
}
