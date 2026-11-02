import { connect as tlsConnect } from "node:tls";
import { Readable, Writable } from "node:stream";

// imap-client.ts가 원래 Cloudflare Workers 전용 cloudflare:sockets의
// connect()를 쓰던 걸, 일반 Node 서버(Docker 셀프호스팅)에서 그대로
// 돌아가게 하기 위한 최소 대체 구현. imap-client.ts는 반환값에서
// readable/writable/close()만 쓰므로 그 셋만 맞춰준다 — IMAP 프로토콜
// 로직(LOGIN/LIST/SELECT/FETCH 파싱)은 전혀 안 건드린다.
// 이 코드베이스에서 IMAP 연결은 항상 묵시적 TLS(IMAPS, 993포트)만
// 쓰므로(secureTransport: "on" 고정, imap-client.ts 참고) STARTTLS나
// 평문 모드는 구현하지 않는다.

export interface SocketAddress {
  hostname: string;
  port: number;
}

export interface ImapSocket {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  close(): Promise<void>;
}

export function connect(address: SocketAddress): ImapSocket {
  const socket = tlsConnect({ host: address.hostname, port: address.port });
  // Node 소켓(Duplex)을 WHATWG 스트림으로 바꿔서 ByteReader(WHATWG
  // ReadableStreamDefaultReader 기반)가 그대로 쓸 수 있게 한다.
  const readable = Readable.toWeb(socket) as unknown as ReadableStream<Uint8Array>;
  const writable = Writable.toWeb(socket) as unknown as WritableStream<Uint8Array>;

  return {
    readable,
    writable,
    close: () =>
      new Promise<void>((resolve) => {
        socket.destroy();
        resolve();
      }),
  };
}
