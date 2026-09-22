export type MessengerMessage = {
  id: string;
  channel_id: string;
  sender_id: string | null;
  content: string;
  file_url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
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
