import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { EditUserForm } from "@/components/edit-user-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { AccessWall } from "@/components/erp/access-wall";
import { deleteUserAccount } from "@/app/(dashboard)/settings/users/actions";
import { getCurrentActor } from "@/lib/current-actor";
import { resolveBackHref } from "@/lib/list-return";

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { back } = await searchParams;
  const closeHref = resolveBackHref("/settings/users", back);
  const supabase = await createClient();
  const { userId, isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return <AccessWall title="환경설정 > 계정관리" message="이 화면은 관리자만 볼 수 있습니다." backHref="/dashboard" />;
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, username, role")
    .eq("id", id)
    .maybeSingle();

  if (!target) {
    notFound();
  }

  const isSelf = target.id === userId;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <ListPageHeader
        title={`환경설정 > 계정관리 > ${target.full_name ?? target.username}`}
        actions={
          !isSelf && (
            <DeleteButton
              action={deleteUserAccount}
              id={target.id}
              confirmMessage={`${target.full_name ?? target.username} 계정을 삭제하시겠습니까? 되돌릴 수 없습니다.`}
            />
          )
        }
      />

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">계정 정보 수정</span>
        </div>
        <div className="erp-detail-body">
          <EditUserForm
            userId={target.id}
            username={target.username ?? ""}
            fullName={target.full_name ?? ""}
            role={target.role}
            isSelf={isSelf}
          />
        </div>
      </div>
    </div>
  );
}
