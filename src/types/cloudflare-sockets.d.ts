// Cloudflare Workers의 cloudflare:sockets 모듈용 최소 타입 선언.
// @cloudflare/workers-types 전체를 끌어오면 브라우저 DOM 타입(Response,
// WebSocket 등)과 충돌할 수 있어서, 메일함 기능(src/lib/mail/imap-client.ts)이
// 실제로 쓰는 부분만 직접 선언했다.
declare module "cloudflare:sockets" {
  export interface SocketOptions {
    secureTransport?: "off" | "on" | "starttls";
    allowHalfOpen?: boolean;
  }

  export interface SocketAddress {
    hostname: string;
    port: number;
  }

  export interface SocketInfo {
    readonly remoteAddress?: string;
    readonly localAddress?: string;
  }

  export interface Socket {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;
    readonly closed: Promise<void>;
    readonly opened: Promise<SocketInfo>;
    close(): Promise<void>;
    startTls(options?: { expectedServerHostname?: string }): Socket;
  }

  export function connect(address: SocketAddress | string, options?: SocketOptions): Socket;
}
