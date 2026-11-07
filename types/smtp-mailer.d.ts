// Types minimaux pour nodemailer 10, installé sous l'alias "smtp-mailer"
// (next-auth n'accepte que nodemailer 7/8, qui ont des failles connues).
declare module "smtp-mailer" {
  type TransportOptions = {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
  };
  type MailOptions = { from: string; to: string; subject: string; text: string; html: string };
  type Transporter = { sendMail(options: MailOptions): Promise<{ messageId: string; accepted: unknown[]; rejected: unknown[] }> };
  const nodemailer: { createTransport(options: TransportOptions): Transporter };
  export default nodemailer;
}
