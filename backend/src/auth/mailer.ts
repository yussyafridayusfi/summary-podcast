import nodemailer, { type Transporter } from "nodemailer";

/**
 * Verification-code delivery.
 *
 * With SMTP_* env vars set, codes go out as real email. Without them we fall
 * back to a console transport: the code is printed in the backend log and
 * (outside production) also returned to the client as `devCode` so the flow
 * can be exercised with zero setup.
 */

const env = (k: string) => process.env[k]?.trim() || undefined;

export const smtpConfigured = !!env("SMTP_HOST");
export const exposeDevCode = !smtpConfigured && process.env.NODE_ENV !== "production";

let transporter: Transporter | null = null;
function getTransport(): Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT") ?? 587),
    secure: env("SMTP_SECURE") === "true",
    auth: env("SMTP_USER") ? { user: env("SMTP_USER"), pass: env("SMTP_PASS") } : undefined,
  });
  return transporter;
}

export interface SendCodeInput {
  to: string;
  code: string;
  purpose: "signup" | "signin";
  appName?: string;
}

export async function sendCode(input: SendCodeInput): Promise<{ delivered: "smtp" | "console" }> {
  const app = input.appName ?? env("APP_NAME") ?? "Summary Hub";
  const subject = `${input.code} is your ${app} ${input.purpose === "signup" ? "sign-up" : "sign-in"} code`;
  const text = [
    `Your ${app} verification code is: ${input.code}`,
    "",
    "It expires in 10 minutes. If you did not request this, you can ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px">
      <h2 style="margin:0 0 8px">${app}</h2>
      <p style="color:#555;margin:0 0 20px">Use this code to ${input.purpose === "signup" ? "finish creating your account" : "sign in"}:</p>
      <div style="font-size:36px;letter-spacing:8px;font-weight:800;background:#f3f0ff;color:#6d4aff;padding:16px 20px;border-radius:12px;text-align:center">${input.code}</div>
      <p style="color:#888;font-size:13px;margin-top:20px">Expires in 10 minutes. If you did not request this, ignore this email.</p>
    </div>`;

  if (!smtpConfigured) {
    console.log(`\n[mail] ➜ ${input.to}\n[mail]   ${subject}\n`);
    return { delivered: "console" };
  }
  await getTransport().sendMail({
    from: env("SMTP_FROM") ?? `${app} <no-reply@${env("SMTP_HOST")}>`,
    to: input.to,
    subject,
    text,
    html,
  });
  return { delivered: "smtp" };
}
