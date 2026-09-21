import { WorkerMailer } from "worker-mailer";

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

// 다음 스마트워크 계정을 그대로 빌려 쓰는 SMTP 발송. Cloudflare Workers는
// nodemailer의 기본 SMTP 트랜스포트(Node net/tls 소켓 가정)를 못 쓰기
// 때문에, cloudflare:sockets 기반으로 이미 만들어진 worker-mailer를 쓴다.
export async function sendMail(params: SendMailParams): Promise<void> {
  const mailer = await WorkerMailer.connect({
    host: params.smtpHost,
    port: params.smtpPort,
    secure: true,
    authType: "plain",
    credentials: {
      username: params.username,
      password: params.password,
    },
  });

  try {
    await mailer.send({
      from: { name: params.fromName ?? params.fromEmail, email: params.fromEmail },
      to: params.to.map((email) => ({ email })),
      cc: params.cc?.map((email) => ({ email })),
      bcc: params.bcc?.map((email) => ({ email })),
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments: params.attachments,
    });
  } finally {
    await mailer.close();
  }
}
