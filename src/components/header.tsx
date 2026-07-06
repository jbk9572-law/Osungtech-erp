import { signOut } from "@/app/login/actions";

export function Header({ email }: { email: string | null }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <span className="text-sm text-gray-500">{email}</span>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          로그아웃
        </button>
      </form>
    </header>
  );
}
