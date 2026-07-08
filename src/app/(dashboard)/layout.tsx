import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ErpShell } from "@/components/erp/erp-shell";
import "@/app/erp-theme.css";

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

  const soonDate = new Date();
  soonDate.setDate(soonDate.getDate() + 3);
  const soonStr = soonDate.toLocaleDateString("sv-SE");

  const [{ data: company }, { data: announcements }, { data: reads }, { data: dueTodos }] =
    await Promise.all([
      supabase.from("company_profile").select("name, logo_mark_url").eq("id", 1).maybeSingle(),
      supabase
        .from("announcements")
        .select("id, title, pinned, created_at")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("announcement_reads").select("announcement_id").eq("user_id", user.id),
      supabase
        .from("todos")
        .select("id, title, due_date")
        .eq("done", false)
        .lte("due_date", soonStr)
        .order("due_date", { ascending: true })
        .limit(20),
    ]);

  const readIds = new Set((reads ?? []).map((r) => r.announcement_id));
  const unreadAnnouncements = (announcements ?? [])
    .filter((a) => !readIds.has(a.id))
    .slice(0, 8)
    .map((a) => ({ id: a.id, title: a.title, pinned: a.pinned }));

  return (
    <ErpShell
      companyName={company?.name}
      logoUrl={company?.logo_mark_url}
      email={user.email ?? null}
      unreadAnnouncements={unreadAnnouncements}
      dueTodos={dueTodos ?? []}
    >
      {children}
    </ErpShell>
  );
}
