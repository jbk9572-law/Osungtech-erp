import { createClient } from "@/lib/supabase/server";
import { MessengerClient } from "@/components/messenger-client";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function MessengerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: messages }, { data: profiles }] = await Promise.all([
    supabase
      .from("messenger_messages")
      .select("id, sender_id, content, file_url, file_path, file_name, file_size, created_at")
      .order("created_at", { ascending: true })
      .limit(200),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const profileNames = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.full_name || "구성원"])
  );

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">사내메신저</h1>
      <MessengerClient
        initialMessages={messages ?? []}
        profileNames={profileNames}
        currentUserId={user?.id ?? ""}
      />
    </div>
  );
}
