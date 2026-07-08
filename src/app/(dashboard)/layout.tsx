import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ErpShell } from "@/components/erp/erp-shell";
import { getNotificationSummary } from "@/lib/notifications";
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

  const [{ data: company }, notifications] = await Promise.all([
    supabase.from("company_profile").select("name, logo_mark_url").eq("id", 1).maybeSingle(),
    getNotificationSummary(supabase, user.id),
  ]);

  return (
    <ErpShell
      companyName={company?.name}
      logoUrl={company?.logo_mark_url}
      email={user.email ?? null}
      unreadAnnouncements={notifications.announcements}
      dueTodos={notifications.todos}
    >
      {children}
    </ErpShell>
  );
}
