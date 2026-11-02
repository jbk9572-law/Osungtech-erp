import nodemailer from "nodemailer";

export type SendMailAttachment = {
  filename: string;
  content: string; // base64
  mimeType: string;
};

export type SendMailParams = {
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string | null;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: SendMailAttachment[];
};

// 다음 스마트워크 계정을 그대로 빌려 쓰는 SMTP 발송. Cloudflare Workers
// 시절엔 nodemailer의 기본 SMTP 트랜스포트(Node net/tls 소켓 가정)를 못
// 써서 cloudflare:sockets 기반 worker-mailer를 썼는데, 일반 Node
// 서버(Docker 셀프호스팅)로 옮기면서 표준 nodemailer로 되돌렸다 —
// 호출부(이 함수의 시그니처)는 그대로라 다른 파일은 손댈 필요 없다.
export async function sendMail(params: SendMailParams): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: params.smtpHost,
    port: params.smtpPort,
    secure: true,
    auth: {
      user: params.username,
      pass: params.password,
    },
  });

  try {
    await transporter.sendMail({
      from: params.fromName ? { name: params.fromName, address: params.fromEmail } : params.fromEmail,
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments: params.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
        contentType: a.mimeType,
      })),
    });
  } finally {
    transporter.close();
  }
}
