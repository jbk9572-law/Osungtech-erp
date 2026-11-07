// 메시지 안에 끼워 넣는 "ERP 연동 카드" — /매출전표, /재고조회 같은
// 명령어로 보낸 메시지가 실제 전표/재고 데이터를 요약해서 보여준다
// (messenger/actions.ts의 sendMessage가 명령어를 해석해 이 모양으로
// 채워 넣는다). kind는 카드 아이콘/강조색을 고르는 용도일 뿐이고, 실제
// 내용은 lines(라벨-값 목록)가 전부라 새 명령어가 추가돼도 렌더링 쪽
// (messenger-page.tsx의 ErpRefCard)을 더 안 고쳐도 된다.
export type MessengerErpRefKind = "sale" | "inventory" | "announcement" | "followup";

export type MessengerErpRef = {
  kind: MessengerErpRefKind;
  title: string;
  badge?: string;
  lines: { label: string; value: string }[];
  href: string;
};

export type MessengerMessage = {
  id: string;
  channel_id: string;
  sender_id: string | null;
  content: string;
  file_url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  erp_ref: MessengerErpRef | null;
  created_at: string;
};

export type MessengerChannelType = "all" | "dm" | "group";

// 목록에 보여줄 채널 하나. DM은 이름이 없어서 상대방 이름을 화면에서
// memberIds/profileNames로 조합해 만든다(서버에서 미리 만들어 내려준다).
export type MessengerChannel = {
  id: string;
  type: MessengerChannelType;
  name: string | null;
  memberIds: string[];
};
