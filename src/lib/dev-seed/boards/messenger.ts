import type { ActingSession, BoardSeedResult } from "../types";
import { MESSENGER_LINES, pick } from "../korean-data";

// "전체" 채널(모든 구성원이 이미 속해 있는 채널)에 더미 대화를 남긴다 —
// DM/그룹방을 새로 만들면 대상 지정이 필요해 복잡해지는 데 비해, 전체
// 채널은 get_or_create_all_channel()로 항상 안전하게 얻을 수 있고
// 실제 메신저 화면(messenger/page.tsx)의 기본 진입 채널과 같다.
export async function seedMessenger(actors: ActingSession[], count: number): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const { data: channelId, error: channelError } = await actor.client.rpc("get_or_create_all_channel");
    if (channelError || !channelId) {
      lastError = channelError?.message ?? "전체 채널을 찾지 못했습니다.";
      continue;
    }
    const { error } = await actor.client.from("messenger_messages").insert({
      channel_id: channelId,
      sender_id: actor.employee.id,
      content: `${pick(MESSENGER_LINES)} (테스트 메시지)`,
      file_url: null,
      file_path: null,
      file_name: null,
      file_size: null,
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "메신저(messenger)", created, error: lastError };
}
