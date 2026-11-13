"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { sanitizeUploadContentType } from "@/lib/upload-safety";
import { notify } from "@/lib/notify";
import { uploadAttachment, deleteAttachment, getAttachmentDownloadUrl } from "@/lib/storage/upload-attachment";
import type { MessengerMessage, MessengerErpRef } from "@/lib/messenger-types";
import { formatNumber } from "@/lib/format-number";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

type Supa = Awaited<ReturnType<typeof createClient>>;

// "ERP 연동 메시지" — /매출전표, /재고조회, /게시판공지, /일정마감으로
// 시작하는 메시지를 보내면, 그 명령어가 가리키는 실제 전표/재고/공지/
// 영업활동 데이터를 조회해서 메시지 안에 카드로 박아 넣는다(사용자가
// 올린 메신저 목업 — "[ERP 연동 전표] 매출 출고 확정 건" 카드 참고).
// 전부 로그인한 사용자의 일반 Supabase 클라이언트로만 조회하므로(관리자
// 클라이언트 아님) 테넌트 격리(RLS)가 평소 화면 조회와 똑같이 적용된다
// — 메신저로 남의 테넌트 전표를 엿볼 수 없다.
//
// 못 찾으면(전표번호 오타, 없는 품목명 등) 에러로 막지 않고 조용히
// erp_ref 없이 평범한 텍스트 메시지로 보낸다 — 채팅은 끊김 없이 되는
// 게 우선이고, 카드가 안 뜨는 것 자체가 "그런 건 못 찾았다"는 신호다.
const ERP_COMMANDS = ["/매출전표", "/재고조회", "/게시판공지", "/일정마감"] as const;

async function buildErpRef(supabase: Supa, content: string): Promise<MessengerErpRef | null> {
  const trimmed = content.trim();
  const command = ERP_COMMANDS.find((c) => trimmed === c || trimmed.startsWith(`${c} `));
  if (!command) return null;
  const arg = trimmed.slice(command.length).trim();

  switch (command) {
    case "/매출전표":
      return buildSaleRef(supabase, arg);
    case "/재고조회":
      return buildInventoryRef(supabase, arg);
    case "/게시판공지":
      return buildAnnouncementRef(supabase, arg);
    case "/일정마감":
      return buildFollowupRef(supabase, arg);
  }
}

async function buildSaleRef(supabase: Supa, arg: string): Promise<MessengerErpRef | null> {
  const docNo = Number(arg);
  if (!arg || !Number.isFinite(docNo)) return null;

  const { data: sale } = await supabase
    .from("sales_orders")
    .select("id, doc_no, customers(name)")
    .eq("doc_no", docNo)
    .maybeSingle();
  if (!sale) return null;

  const { data: items } = await supabase
    .from("sales_order_items")
    .select("quantity, unit_price, custom_name, products(name)")
    .eq("sales_order_id", sale.id);
  const rows = items ?? [];
  const total = rows.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
  const firstName = rows[0]?.products?.name ?? rows[0]?.custom_name ?? "품목";
  const itemSummary = rows.length > 1 ? `${firstName} 외 ${rows.length - 1}건` : firstName;

  return {
    kind: "sale",
    title: `매출전표 #${sale.doc_no}`,
    badge: `#${sale.doc_no}`,
    lines: [
      { label: "거래처", value: sale.customers?.name ?? "-" },
      { label: "품목", value: rows.length ? itemSummary : "-" },
      { label: "공급가액", value: `${formatNumber(total)}원` },
    ],
    href: `/sales/${sale.id}`,
  };
}

async function buildInventoryRef(supabase: Supa, arg: string): Promise<MessengerErpRef | null> {
  if (!arg) return null;

  const { data: product } = await supabase
    .from("products")
    .select("id, name, sku, unit, reorder_point")
    .ilike("name", `%${arg}%`)
    .limit(1)
    .maybeSingle();
  if (!product) return null;

  const { data: invRows } = await supabase.from("inventory").select("quantity").eq("product_id", product.id);
  const totalQty = (invRows ?? []).reduce((sum, r) => sum + r.quantity, 0);
  const low = totalQty <= product.reorder_point;

  return {
    kind: "inventory",
    title: `재고조회 - ${product.name}`,
    badge: product.sku,
    lines: [
      { label: "현재고", value: `${formatNumber(totalQty)} ${product.unit}` },
      { label: "안전재고", value: `${formatNumber(product.reorder_point)} ${product.unit}` },
      { label: "상태", value: low ? "재고위험" : "정상" },
    ],
    href: `/inventory?q=${encodeURIComponent(product.name)}`,
  };
}

async function buildAnnouncementRef(supabase: Supa, arg: string): Promise<MessengerErpRef | null> {
  let query = supabase
    .from("announcements")
    .select("id, title, created_at, pinned")
    .order("created_at", { ascending: false })
    .limit(1);
  if (arg) query = query.ilike("title", `%${arg}%`);
  const { data: ann } = await query.maybeSingle();
  if (!ann) return null;

  return {
    kind: "announcement",
    title: "공지사항",
    badge: ann.pinned ? "고정" : undefined,
    lines: [
      { label: "제목", value: ann.title },
      { label: "등록일", value: new Date(ann.created_at).toLocaleDateString("ko-KR") },
    ],
    href: `/announcements/${ann.id}`,
  };
}

async function buildFollowupRef(supabase: Supa, arg: string): Promise<MessengerErpRef | null> {
  let customerId: string | null = null;
  if (arg) {
    const { data: customer } = await supabase.from("customers").select("id").ilike("name", `%${arg}%`).limit(1).maybeSingle();
    if (!customer) return null;
    customerId = customer.id;
  }

  let query = supabase
    .from("sales_activities")
    .select("next_action_date, next_action_memo, customers(name)")
    .eq("next_action_done", false)
    .not("next_action_date", "is", null)
    .order("next_action_date", { ascending: true })
    .limit(1);
  if (customerId) query = query.eq("customer_id", customerId);
  const { data: activity } = await query.maybeSingle();
  if (!activity || !activity.next_action_date) return null;

  return {
    kind: "followup",
    title: "팔로우업 일정",
    lines: [
      { label: "거래처", value: activity.customers?.name ?? "-" },
      { label: "예정일", value: new Date(activity.next_action_date).toLocaleDateString("ko-KR") },
      { label: "메모", value: activity.next_action_memo ?? "-" },
    ],
    href: "/sales-activities",
  };
}

export type SendMessageState =
  | { error?: string; success?: string; message?: MessengerMessage }
  | undefined;

export async function sendMessage(
  _prevState: SendMessageState,
  formData: FormData
): Promise<SendMessageState> {
  const channelId = String(formData.get("channel_id") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  if (!channelId) {
    return { error: "채널을 선택해주세요." };
  }
  if (!content && !hasFile) {
    return { error: "메시지나 파일을 입력해주세요." };
  }
  if (hasFile && file.size > MAX_FILE_SIZE) {
    return { error: "파일은 20MB 이하만 첨부할 수 있습니다." };
  }

  const supabase = await createClient();
  const user = await getUser();
  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  let fileUrl: string | null = null;
  let filePath: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;

  if (hasFile && file instanceof File) {
    // Supabase 스토리지 키는 한글 등 비ASCII 문자를 거부한다("Invalid key" 에러).
    // 원본 파일명은 file_name 컬럼에 그대로 저장해 화면 표시/다운로드에 쓰고,
    // 실제 저장 경로는 확장자만 남긴 ASCII 전용 키로 만든다.
    const extMatch = file.name.match(/\.[A-Za-z0-9]+$/);
    const ext = extMatch ? extMatch[0].toLowerCase() : "";
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}${ext}`;
    // 첨부파일은 문서/이미지/압축파일 등 어떤 형식이든 허용해야 하지만,
    // 브라우저가 그대로 실행/렌더링할 수 있는 타입(HTML/SVG/JS)만은 URL을
    // 직접 열었을 때 저장된 XSS로 이어질 수 있어 안전한 범용 타입으로
    // 바꿔서 저장한다 — 그 외 정상적인 업무 파일 형식은 그대로 유지된다.
    const uploaded = await uploadAttachment({
      supabase,
      bucket: "messenger-attachments",
      path,
      file,
      contentType: sanitizeUploadContentType(file.type),
      // messenger_messages.file_url은 원래 영구 공개 URL을 저장해두는
      // 컬럼이었는데, R2는 영구 URL이 없다(publicUrl: null로 돌아옴) —
      // 그래서 화면(messenger-page.tsx)에서 file_url이 비어있으면
      // resolveMessengerAttachmentUrl() 서버 액션으로 그때그때 단기
      // Presigned URL을 새로 받아오도록 같이 바꿔뒀다. 기존에 이미
      // Supabase에 저장된 첨부는 file_url이 그대로 있으니 영향 없다.
      preferR2: true,
    });

    if (!uploaded.ok) {
      console.error("messenger file upload failed:", uploaded.error);
      return { error: `파일 업로드에 실패했습니다. (${uploaded.error})` };
    }

    fileUrl = uploaded.publicUrl;
    filePath = uploaded.path;
    fileName = file.name;
    fileSize = file.size;
  }

  // 슬래시 명령어(/매출전표 등)면 실제 ERP 데이터를 카드로 조회해서
  // erp_ref에 채우고, 그 경우 평문 content는 비워서(카드만 보이게)
  // 보낸다 — 못 찾았으면(null) 원래 타이핑한 텍스트를 그대로 평범한
  // 메시지로 보낸다.
  const erpRef = await buildErpRef(supabase, content);
  const storedContent = erpRef ? "" : content;

  const { data: inserted, error } = await supabase
    .from("messenger_messages")
    .insert({
      channel_id: channelId,
      sender_id: user.id,
      content: storedContent,
      file_url: fileUrl,
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
      erp_ref: erpRef,
    })
    .select("id, channel_id, sender_id, content, file_url, file_path, file_name, file_size, erp_ref, created_at")
    .single();

  if (error || !inserted) {
    console.error("messenger message insert failed:", error);
    return { error: `전송에 실패했습니다.${error ? ` (${error.message})` : ""}` };
  }

  await notifyChannelMembers(supabase, user.id, channelId, erpRef ? erpRef.title : content, hasFile);

  return { success: "전송했습니다.", message: inserted as unknown as MessengerMessage };
}

// DM/그룹방에만 알림을 보낸다 — "전체" 채널은 테넌트 전원이 참여자라
// 메시지마다 모두에게 알림을 쏘면 스팸이 되므로 제외한다(그 채널은
// 지금까지처럼 위젯을 열어둔 동안의 실시간 구독으로만 확인).
async function notifyChannelMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  senderId: string,
  channelId: string,
  content: string,
  hasFile: boolean,
): Promise<void> {
  const [{ data: channel }, { data: members }, { data: senderProfile }] = await Promise.all([
    supabase.from("messenger_channels").select("type, name").eq("id", channelId).maybeSingle(),
    supabase.from("messenger_channel_members").select("user_id").eq("channel_id", channelId).neq("user_id", senderId),
    supabase.from("profiles").select("full_name").eq("id", senderId).maybeSingle(),
  ]);
  if (!channel || channel.type === "all" || !members?.length) return;

  const senderName = senderProfile?.full_name ?? "구성원";
  const body = content || (hasFile ? "파일을 보냈습니다." : "");
  const title = channel.type === "group" ? `${channel.name ?? "그룹"} · ${senderName}` : `${senderName}님의 메시지`;

  await notify(supabase, {
    userIds: members.map((m) => m.user_id),
    type: channel.type === "group" ? "messenger_group" : "messenger_dm",
    title,
    body,
    url: `/dashboard?openMessenger=${channelId}`,
  });
}

// 위젯이 삭제 성공 여부를 알아야 실패 시 화면에서 지웠던 메시지를 되돌릴 수
// 있다 — 이전에는 반환값이 없어서 삭제가 실패해도(RLS, 일시적 오류 등)
// 보낸 사람 화면에서만 조용히 사라지고 다른 사람에게는 그대로 보이는
// 불일치가 있었다.
export async function deleteMessage(formData: FormData): Promise<{ error?: string }> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 관리자는 탈퇴한 계정이 남긴 메시지처럼 본인이 아니어도 정리할 수
  // 있어야 한다(migration 126 — RLS도 본인 또는 같은 테넌트 관리자를
  // 허용하도록 같이 넓혀뒀다). file_path/sender_id는 폼에서 그대로
  // 믿지 않고 DB에서 다시 조회한다.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.role === "admin";

  const { data: message } = await supabase
    .from("messenger_messages")
    .select("sender_id, file_path, file_size")
    .eq("id", id)
    .maybeSingle();
  if (!message || (message.sender_id !== user.id && !isAdmin)) {
    return { error: "본인 메시지만 삭제할 수 있습니다." };
  }

  if (message.file_path) {
    await deleteAttachment({
      supabase,
      bucket: "messenger-attachments",
      path: message.file_path,
      sizeBytes: message.file_size,
    });
  }
  const { error } = await supabase.from("messenger_messages").delete().eq("id", id);
  if (error) return { error: `삭제에 실패했습니다: ${error.message}` };
  return {};
}

export type ChannelActionState = { error?: string; channelId?: string } | undefined;

// DM은 상대방 한 명을 고르면 되고, 이미 만든 적 있으면 그 채널을 그대로
// 재사용한다(create_dm_channel RPC가 처리).
export async function startDirectMessage(otherUserId: string): Promise<ChannelActionState> {
  if (!otherUserId) return { error: "대화 상대를 선택해주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_dm_channel", { p_other_user_id: otherUserId });
  if (error || !data) return { error: `대화를 시작하지 못했습니다.${error ? ` (${error.message})` : ""}` };
  return { channelId: data };
}

export async function createGroup(
  _prevState: ChannelActionState,
  formData: FormData
): Promise<ChannelActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const memberIds = formData.getAll("member_id").map(String).filter(Boolean);

  if (!name) return { error: "그룹 이름을 입력해주세요." };
  if (memberIds.length === 0) return { error: "그룹원을 한 명 이상 선택해주세요." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group_channel", {
    p_name: name,
    p_member_ids: memberIds,
  });
  if (error || !data) return { error: `그룹을 만들지 못했습니다.${error ? ` (${error.message})` : ""}` };
  return { channelId: data };
}

// R2로 저장된 첨부(file_url이 비어있고 file_path만 있는 경우)를 화면에서
// 그때그때 열람용 단기 URL로 바꿔주는 서버 액션 — R2 접속 키는 서버에만
// 있으므로 클라이언트 컴포넌트(messenger-page.tsx)가 직접 서명할 수 없다.
// 메시지 목록 조회(messenger_messages_select_authenticated)와 똑같이
// "로그인한 사용자면 누구나"까지만 확인한다 — 기존 file_url 노출 수준과
// 동일하다.
export async function resolveMessengerAttachmentUrl(filePath: string): Promise<string | null> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user || !filePath) return null;
  // 임의의 경로로 서명 URL을 만들어 가는 것을 막는다 — 이 사용자가 조회할 수 있는(RLS) 메시지에 실제로
  // 붙어 있는 첨부 경로일 때만 열람 URL을 발급한다.
  const { data: attached } = await supabase
    .from("messenger_messages")
    .select("id")
    .eq("file_path", filePath)
    .limit(1);
  if (!attached || attached.length === 0) return null;
  return getAttachmentDownloadUrl({ supabase, bucket: "messenger-attachments", path: filePath });
}

export async function leaveGroup(channelId: string): Promise<{ error?: string }> {
  if (!channelId) return { error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_messenger_channel", { p_channel_id: channelId });
  if (error) return { error: `나가기에 실패했습니다: ${error.message}` };
  return {};
}

// 이 채널을 "지금까지 다 읽음"으로 표시한다 — 메인 화면 "메신저" 탭의 안 읽은 개수가 이 값으로 계산된다.
// 대화창을 열 때와, 열어 둔 대화에 새 메시지가 올 때 부른다. 실패해도 대화에는 영향이 없다(조용히 무시).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function markMessengerChannelRead(channelId: string): Promise<void> {
  const user = await getUser();
  if (!user || !UUID_RE.test(channelId)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_messenger_channel_read", { p_channel_id: channelId });
  if (error) console.error("메신저 읽음 처리 실패:", error.message);
}
