import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50 print:block print:bg-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col print:block">
        <Header email={user.email ?? null} />
        <main className="flex-1 p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
