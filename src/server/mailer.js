import nodemailer from "nodemailer";

export const DEFAULT_EMAIL_CONFIG = {
  id: "email",
  provider: "titan",
  smtp_host: "smtp.titan.email",
  smtp_port: 465,
  smtp_secure: true,
  smtp_user: "",
  smtp_password: "",
  from_name: "IndiFunded",
  from_email: "",
  reply_to: "",
  welcome_enabled: true,
  welcome_subject: "Welcome to IndiFunded — Your ₹1,00,000 Platform Explorer is Live",
  welcome_body:
    "Hi {{name}},\n\nWelcome to IndiFunded! Your 5-minute ₹1,00,000 Platform Explorer trial is ready inside the Trading Terminal with live NSE & BSE market feeds.\n\nExplore our 17 dashboard tools, test live order execution, and unlock a Challenge Account whenever you are ready to trade toward 70% profit splits.\n\nHappy trading,\nTeam IndiFunded",
  updated_at: "",
};

export function sanitizeEmailConfigForAdmin(cfg) {
  const merged = { ...DEFAULT_EMAIL_CONFIG, ...(cfg || {}) };
  const hasPassword = Boolean(merged.smtp_password);
  const { smtp_password: _hidden, ...safe } = merged;
  return {
    ...safe,
    has_password: hasPassword,
  };
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtmlEmail({ title, preheader, bodyLines, ctaLabel, ctaUrl }) {
  const paragraphs = bodyLines
    .filter((l) => l.trim().length > 0)
    .map(
      (l) =>
        `<p style="margin:0 0 14px 0;color:#cbd5e1;font-size:15px;line-height:1.65;">${escapeHtml(l)}</p>`,
    )
    .join("");
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<div style="margin:26px 0 8px 0;">
           <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#1a7a4a;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:999px;">
             ${escapeHtml(ctaLabel)}
           </a>
         </div>`
      : "";
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#060709;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader || title)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#060709;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#0f141c;border:1px solid #1f2937;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #1f2630;background:linear-gradient(135deg,#0d1b15,#0f141c);">
              <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#29d39a;font-weight:700;">IndiFunded · Trader Desk</div>
              <h1 style="margin:8px 0 0 0;color:#ffffff;font-size:22px;line-height:1.25;font-weight:600;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px;">
              ${paragraphs}
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;border-top:1px solid #1f2630;color:#64748b;font-size:12px;">
              IndiFunded · BRVS Education Pvt Ltd · Automated account notification
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function createTransporter(cfg) {
  const host = String(cfg.smtp_host || "smtp.titan.email").trim();
  const port = Number(cfg.smtp_port) || 465;
  const secure = cfg.smtp_secure !== undefined ? Boolean(cfg.smtp_secure) : port === 465;
  const user = String(cfg.smtp_user || "").trim();
  const pass = String(cfg.smtp_password || "");
  if (!host || !user || !pass) {
    throw new Error("Titan SMTP email and password must be saved before sending.");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 12000,
  });
}

function senderHeader(cfg) {
  const name = String(cfg.from_name || "IndiFunded").trim();
  const addr = String(cfg.from_email || cfg.smtp_user || "").trim();
  return name ? `"${name.replace(/"/g, "")}" <${addr}>` : addr;
}

export async function sendWelcomeEmail({ to, name, config, origin }) {
  const cfg = { ...DEFAULT_EMAIL_CONFIG, ...(config || {}) };
  if (!cfg.welcome_enabled || !cfg.smtp_user || !cfg.smtp_password || !to) {
    return { sent: false, reason: "not_configured" };
  }
  try {
    const transporter = createTransporter(cfg);
    const firstName = String(name || "Trader").trim().split(/\s+/)[0] || "Trader";
    const subject = String(cfg.welcome_subject || DEFAULT_EMAIL_CONFIG.welcome_subject).replace(
      /\{\{name\}\}/g,
      firstName,
    );
    const rawBody = String(cfg.welcome_body || DEFAULT_EMAIL_CONFIG.welcome_body)
      .replace(/\{\{name\}\}/g, firstName)
      .replace(/\{\{email\}\}/g, to);
    const terminalUrl = origin ? `${origin.replace(/\/+$/, "")}/app/terminal` : "";
    const html = buildHtmlEmail({
      title: `Welcome to IndiFunded, ${firstName}`,
      preheader: "Your ₹1,00,000 5-minute Platform Explorer trial is ready.",
      bodyLines: rawBody.split(/\r?\n/),
      ctaLabel: terminalUrl ? "Launch Trading Terminal" : "",
      ctaUrl: terminalUrl,
    });
    const info = await transporter.sendMail({
      from: senderHeader(cfg),
      replyTo: cfg.reply_to || cfg.from_email || cfg.smtp_user,
      to,
      subject,
      text: rawBody,
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.warn("[mailer] Welcome email skipped/failed:", err?.message || err);
    return { sent: false, reason: err?.message || "send_failed" };
  }
}

export async function sendPasswordResetEmail({ to, resetUrl, config }) {
  const cfg = { ...DEFAULT_EMAIL_CONFIG, ...(config || {}) };
  if (!cfg.smtp_user || !cfg.smtp_password || !to || !resetUrl) {
    return { sent: false, reason: "not_configured" };
  }
  const transporter = createTransporter(cfg);
  const text = `Reset your IndiFunded password\n\nWe received a request to reset your password for ${to}.\nOpen this link to choose a new password:\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`;
  const html = buildHtmlEmail({
    title: "Reset your IndiFunded password",
    preheader: "Use this secure link to choose a new password.",
    bodyLines: [
      `We received a request to reset the password for ${to}.`,
      "Click the button below to choose a new password for your IndiFunded account.",
      "If you did not request a password change, you can safely ignore this email.",
    ],
    ctaLabel: "Reset Password",
    ctaUrl: resetUrl,
  });
  const info = await transporter.sendMail({
    from: senderHeader(cfg),
    replyTo: cfg.reply_to || cfg.from_email || cfg.smtp_user,
    to,
    subject: "Reset your IndiFunded password",
    text,
    html,
  });
  return { sent: true, messageId: info.messageId };
}

export async function sendTestEmail({ to, config, origin }) {
  const cfg = { ...DEFAULT_EMAIL_CONFIG, ...(config || {}) };
  const transporter = createTransporter(cfg);
  await transporter.verify();
  const text = `Titan Email SMTP connection verified for ${cfg.from_email || cfg.smtp_user}.\nAutomated Welcome and Password Reset notifications are ready.`;
  const html = buildHtmlEmail({
    title: "Titan Business Email Connected",
    preheader: "Your IndiFunded SMTP configuration passed verification.",
    bodyLines: [
      `Your Titan Email mailbox (${cfg.smtp_user}) successfully connected over ${cfg.smtp_host}:${cfg.smtp_port}.`,
      "New signups and first-time logins will receive your customized Welcome Email automatically.",
    ],
    ctaLabel: origin ? "Open Admin Panel" : "",
    ctaUrl: origin ? `${origin.replace(/\/+$/, "")}/admin/settings` : "",
  });
  const info = await transporter.sendMail({
    from: senderHeader(cfg),
    replyTo: cfg.reply_to || cfg.from_email || cfg.smtp_user,
    to,
    subject: "IndiFunded Titan Email — SMTP Test Passed",
    text,
    html,
  });
  return { sent: true, messageId: info.messageId };
}
