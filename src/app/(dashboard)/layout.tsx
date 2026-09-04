import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ErpShell } from "@/components/erp/erp-shell";
import { getNotificationSummary } from "@/lib/notifications";
import { getDatabaseSizeBytes, getStorageSizeBytes } from "@/lib/db-usage";
import { getVpsDiskUsage } from "@/lib/vps-usage";
import { getNetlifyUsage } from "@/lib/netlify-usage";
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

  const [
    { data: company },
    notifications,
    { data: messages },
    { data: profiles },
    dbSizeBytes,
    storageSizeBytes,
    netlifyUsage,
  ] = await Promise.all([
    supabase
      .from("company_profile")
      .select("name, logo_mark_url")
      .maybeSingle(),
    getNotificationSummary(supabase, user.id),
    supabase
      .from("messenger_messages")
      .select(
        "id, sender_id, content, file_url, file_path, file_name, file_size, created_at",
      )
      // 최신 100건을 가져온 뒤(내림차순), 화면에는 예전 메시지가 위로 오는
      // 순서로 보여줘야 하므로 아래에서 다시 뒤집는다.
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("profiles").select("id, full_name"),
    getDatabaseSizeBytes(supabase),
    getStorageSizeBytes(supabase),
    getNetlifyUsage(),
  ]);
  const vpsDisk = getVpsDiskUsage();

  const profileNames = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.full_name || "구성원"]),
  );

  return (
    <ErpShell
      companyName={company?.name}
      logoUrl={company?.logo_mark_url}
      email={user.email ?? null}
      unreadAnnouncements={notifications.announcements}
      dueTodos={notifications.todos}
      lowStock={notifications.lowStock}
      initialMessages={(messages ?? []).slice().reverse()}
      profileNames={profileNames}
      currentUserId={user.id}
      dbSizeBytes={dbSizeBytes}
      storageSizeBytes={storageSizeBytes}
      vpsDisk={vpsDisk}
      netlifyUsage={netlifyUsage}
    >
      {children}
    </ErpShell>
  );
}
