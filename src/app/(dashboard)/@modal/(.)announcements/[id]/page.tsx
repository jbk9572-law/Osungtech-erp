import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import AnnouncementDetailPage from "@/app/(dashboard)/announcements/[id]/page";
import { resolveBackHref } from "@/lib/list-return";

export default async function InterceptedAnnouncementDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { back } = await props.searchParams;
  return (
    <RegistrationModalShell size="md" closeHref={resolveBackHref("/announcements", back)}>
      <AnnouncementDetailPage {...props} />
    </RegistrationModalShell>
  );
}
