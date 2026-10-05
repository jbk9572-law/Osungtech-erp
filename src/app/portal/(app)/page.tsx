import { redirect } from "next/navigation";
import { portalHref } from "@/lib/portal-path";

export default async function PortalHomePage() {
  redirect(await portalHref("/orders"));
}
