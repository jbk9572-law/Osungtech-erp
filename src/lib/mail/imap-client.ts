import { connect } from "cloudflare:sockets";
import { decodeImapUtf7, encodeImapUtf7 } from "./utf7";

// 아웃룩/다음 웹메일과 똑같은 "IMAP 클라이언트" 역할을 이 앱이 직접
// 대신하기 위한 최소 구현. Cloudflare Workers는 Node의 net/tls 모듈을
// 못 쓰고 대신 cloudflare:sockets의 connect()로 TCP 소켓을 직접 다뤄야
// 해서(공식 IMAP 라이브러리들이 대부분 Node 전용이라 그대로 못 씀),
// LOGIN/LIST/SELECT/UID FETCH 네 가지 명령만 필요한 만큼 직접 구현했다.
// 메시지 본문 파싱(MIME)은 postal-mime에 맡기고, 여기서는 원본 RFC822
// 바이트를 그대로 가져오는 역할까지만 한다.

type PendingImapSocket = ReturnType<typeof connect>;

class ByteReader {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private buffer: Uint8Array = new Uint8Array(0);

  constructor(socket: PendingImapSocket) {
    this.reader = socket.readable.getReader();
  }

  private append(chunk: Uint8Array) {
    const merged = new Uint8Array(this.buffer.length + chunk.length);
    merged.set(this.buffer, 0);
    merged.set(chunk, this.buffer.length);
    this.buffer = merged;
  }

  private async fill(): Promise<boolean> {
    const { value, done } = await this.reader.read();
    if (done) return false;
    if (value) this.append(value);
    return true;
  }

  // CRLF까지의 한 줄을 텍스트로 반환한다(개행 문자 제외). 프로토콜
  // 제어 라인은 항상 ASCII/UTF-8 안전 텍스트라 리터럴 바이트와 분리해서
  // 다룰 수 있다.
  async readLine(): Promise<string> {
    for (;;) {
      const idx = this.buffer.indexOf(10); // '\n'
      if (idx !== -1) {
        const lineBytes = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 1);
        const text = new TextDecoder().decode(lineBytes);
        return text.endsWith("\r") ? text.slice(0, -1) : text;
      }
      if (!(await this.fill())) {
        throw new Error("IMAP 연결이 예기치 않게 종료되었습니다.");
      }
    }
  }

  // 정확히 n바이트를 원본 그대로(디코딩 없이) 반환한다 — FETCH 리터럴 본문용.
  async readBytes(n: number): Promise<Uint8Array> {
    while (this.buffer.length < n) {
      if (!(await this.fill())) {
        throw new Error("IMAP 연결이 예기치 않게 종료되었습니다(리터럴 읽기 중).");
      }
    }
    const bytes = this.buffer.slice(0, n);
    this.buffer = this.buffer.slice(n);
    return bytes;
  }
}

export type ImapFolder = { displayName: string; rawName: string };
export type ImapRawMessage = { uid: number; raw: Uint8Array };

export class ImapClient {
  private socket: PendingImapSocket;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private reader: ByteReader;
  private tagCounter = 0;

  private constructor(socket: PendingImapSocket) {
    this.socket = socket;
    this.writer = socket.writable.getWriter();
    this.reader = new ByteReader(socket);
  }

  static async connect(host: string, port: number): Promise<ImapClient> {
    const socket = connect({ hostname: host, port }, { secureTransport: "on" });
    const client = new ImapClient(socket);
    // 서버 인사말(* OK ...) 한 줄을 소비한다.
    await client.reader.readLine();
    return client;
  }

  private nextTag(): string {
    this.tagCounter += 1;
    return `A${this.tagCounter}`;
  }

  private async writeLine(text: string) {
    await this.writer.write(new TextEncoder().encode(text + "\r\n"));
  }

  // 리터럴이 섞여 있지 않은 일반 명령(LOGIN/SELECT/LIST/LOGOUT 등).
  // 태그가 붙은 최종 응답 줄을 만날 때까지 모든 "* ..." 줄을 모아 반환한다.
  private async sendSimple(command: string): Promise<{ ok: boolean; statusLine: string; lines: string[] }> {
    const tag = this.nextTag();
    await this.writeLine(`${tag} ${command}`);
    const lines: string[] = [];
    for (;;) {
      const line = await this.reader.readLine();
      if (line.startsWith(`${tag} `)) {
        const ok = line.slice(tag.length + 1).toUpperCase().startsWith("OK");
        return { ok, statusLine: line, lines };
      }
      lines.push(line);
    }
  }

  // IMAP 문자열 리터럴로 감싼다(따옴표/역슬래시만 이스케이프 — 앱 비밀번호는
  // 보통 영숫자라 이 정도로 충분하고, 별도 continuation 왕복 없이 한 줄로
  // 끝낼 수 있다).
  private static quote(value: string): string {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }

  async login(username: string, password: string): Promise<void> {
    const result = await this.sendSimple(`LOGIN ${ImapClient.quote(username)} ${ImapClient.quote(password)}`);
    if (!result.ok) {
      throw new Error(`IMAP 로그인 실패: ${result.statusLine}`);
    }
  }

  async listFolders(): Promise<ImapFolder[]> {
    const result = await this.sendSimple(`LIST "" "*"`);
    if (!result.ok) throw new Error(`IMAP LIST 실패: ${result.statusLine}`);

    const folders: ImapFolder[] = [];
    for (const line of result.lines) {
      // * LIST (\HasNoChildren) "/" "받은편지함"  (마지막 mailbox 이름은
      // 따옴표로 감싸져 있거나, 특수문자가 없으면 그냥 붙어 있을 수도 있다.
      const match = line.match(/^\* LIST \([^)]*\)\s+(?:"[^"]*"|NIL)\s+(.+)$/i);
      if (!match) continue;
      let rawName = match[1].trim();
      if (rawName.startsWith('"') && rawName.endsWith('"')) {
        rawName = rawName.slice(1, -1);
      }
      folders.push({ rawName, displayName: decodeImapUtf7(rawName) });
    }
    return folders;
  }

  // SELECT 후 현재 메일함의 총 메시지 수(EXISTS)를 반환한다.
  async selectFolder(rawName: string): Promise<{ exists: number }> {
    const encoded = encodeImapUtf7(rawName);
    const result = await this.sendSimple(`SELECT ${ImapClient.quote(encoded)}`);
    if (!result.ok) throw new Error(`IMAP SELECT 실패(${rawName}): ${result.statusLine}`);

    let exists = 0;
    for (const line of result.lines) {
      const m = line.match(/^\* (\d+) EXISTS/i);
      if (m) exists = Number(m[1]);
    }
    return { exists };
  }

  private async fetchRawInternal(command: string): Promise<ImapRawMessage[]> {
    const tag = this.nextTag();
    await this.writeLine(`${tag} ${command}`);

    const messages: ImapRawMessage[] = [];
    for (;;) {
      const line = await this.reader.readLine();
      if (line.startsWith(`${tag} `)) {
        const ok = line.slice(tag.length + 1).toUpperCase().startsWith("OK");
        if (!ok) throw new Error(`IMAP FETCH 실패: ${line}`);
        break;
      }

      const literalMatch = line.match(/\{(\d+)\}\s*$/);
      if (line.startsWith("* ") && literalMatch && /FETCH/i.test(line)) {
        const uidMatch = line.match(/UID (\d+)/i);
        const size = Number(literalMatch[1]);
        const raw = await this.reader.readBytes(size);
        // 리터럴 뒤에 남은 ")" 닫는 줄을 마저 소비한다.
        await this.reader.readLine();
        if (uidMatch) {
          messages.push({ uid: Number(uidMatch[1]), raw });
        }
      }
      // 그 외 untagged 줄(예: "* n FETCH (FLAGS (...))")은 무시한다.
    }
    return messages;
  }

  // range 예: "1234:*" — 마지막으로 동기화한 UID 다음부터 증분 동기화할 때.
  async uidFetchRaw(range: string): Promise<ImapRawMessage[]> {
    return this.fetchRawInternal(`UID FETCH ${range} (UID RFC822)`);
  }

  // range 예: "50:*" — 시퀀스 번호 기준. 처음 연동하는 계정에서 "최근 N통만"
  // 가져올 때 쓴다(UID를 아직 몰라도 SELECT가 알려준 총 개수로 범위를 정할
  // 수 있어서).
  async seqFetchRaw(range: string): Promise<ImapRawMessage[]> {
    return this.fetchRawInternal(`FETCH ${range} (UID RFC822)`);
  }

  async logout(): Promise<void> {
    try {
      await this.sendSimple("LOGOUT");
    } catch {
      // 로그아웃 실패는 무시하고 소켓만 닫는다.
    } finally {
      try {
        await this.writer.close();
      } catch {
        // ignore
      }
      try {
        await this.socket.close();
      } catch {
        // ignore
      }
    }
  }
}
