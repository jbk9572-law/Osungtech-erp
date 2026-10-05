import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { portalHref } from "@/lib/portal-path";

export default async function PortalHomePage() {
  const supabase = await createClient();
  const { data: identity, error } = await supabase.rpc("portal_identity");
  if (error) {
    redirect(await portalHref("/login"));
  }
  const kind = identity?.[0]?.kind;
  redirect(await portalHref(kind === "subcontractor" ? "/assignments" : "/orders"));
}
