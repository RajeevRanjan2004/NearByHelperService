import nodemailer from "nodemailer";
import env from "../config/env.js";

function isEmailServiceConfigured() {
  return Boolean(
    (env.gmailUser && env.gmailPassword) ||
      (env.smtpHost && env.smtpUser && env.smtpPass && (env.smtpFrom || env.smtpUser))
  );
}

function formatSenderAddress(address) {
  const normalizedAddress = String(address || "").trim();
  const displayName = String(env.emailFromName || env.businessName || "").trim();

  if (!normalizedAddress) {
    return "";
  }

  if (!displayName) {
    return normalizedAddress;
  }

  const escapedDisplayName = displayName.replace(/"/g, '\\"');
  return `"${escapedDisplayName}" <${normalizedAddress}>`;
}

async function createTransporter() {
  if (env.gmailUser && env.gmailPassword) {
    return {
      transporter: nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: env.gmailUser,
          pass: env.gmailPassword,
        },
      }),
      fromAddress: env.smtpFrom || env.gmailUser,
    };
  }

  if (!env.smtpHost || !env.smtpUser || !env.smtpPass || !(env.smtpFrom || env.smtpUser)) {
    throw new Error(
      "Email OTP service is not configured. Set SMTP or Gmail credentials on the server."
    );
  }

  return {
    transporter: nodemailer.createTransport({
      host: env.smtpHost,
      port: Number(env.smtpPort || 587),
      secure: Number(env.smtpPort || 587) === 465,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    }),
    fromAddress: env.smtpFrom || env.smtpUser,
  };
}

async function sendEmailMessage({ toEmail, subject, text, html }) {
  const { transporter, fromAddress } = await createTransporter();

  await transporter.sendMail({
    from: formatSenderAddress(fromAddress),
    ...(env.supportEmail ? { replyTo: env.supportEmail } : {}),
    to: toEmail,
    subject,
    text,
    html,
  });
}

function buildOtpEmailContent({ userName, otpCode, purpose }) {
  const isDeleteOtp = purpose === "account-delete";
  const title = isDeleteOtp ? "Account delete verification" : "Password reset OTP";
  const intro = isDeleteOtp
    ? "You requested an OTP to confirm account deletion."
    : "You requested an OTP to reset your password.";
  const actionLine = isDeleteOtp
    ? "Enter this OTP on the account settings page to continue."
    : "Enter this OTP on the reset password page to continue.";
  const actionUrl = isDeleteOtp ? `${env.appUrl}/account` : `${env.appUrl}/reset-password`;

  const text = [
    `Hi ${userName || "there"},`,
    "",
    intro,
    `Your OTP is: ${otpCode}`,
    "",
    "This OTP will expire in 10 minutes.",
    actionLine,
    `Open page: ${actionUrl}`,
    "If you did not request this, please ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
      <h2 style="margin-bottom:8px;">${env.businessName} ${title}</h2>
      <p style="margin:0 0 16px;">Hi ${userName || "there"},</p>
      <p style="margin:0 0 16px;">${intro}</p>
      <div style="margin:24px 0;padding:16px;border-radius:10px;background:#111827;color:#ffffff;text-align:center;">
        <div style="font-size:13px;letter-spacing:1px;opacity:0.8;">YOUR OTP</div>
        <div style="font-size:32px;font-weight:700;letter-spacing:10px;margin-top:6px;">${otpCode}</div>
      </div>
      <p style="margin:0 0 10px;">This OTP will expire in 10 minutes.</p>
      <p style="margin:0 0 10px;">${actionLine}</p>
      <p style="margin:0 0 12px;"><a href="${actionUrl}" style="color:#c2410c;font-weight:700;">Open the secure page</a></p>
      <p style="margin:0;color:#6b7280;">If you did not request this, please ignore this email.</p>
    </div>
  `;

  return {
    subject: `${env.businessName} ${title}`,
    text,
    html,
  };
}

async function sendOtpEmail({ toEmail, userName, otpCode, purpose }) {
  const { subject, text, html } = buildOtpEmailContent({
    userName,
    otpCode,
    purpose,
  });

  await sendEmailMessage({
    toEmail,
    subject,
    text,
    html,
  });

  return {
    provider: "email",
    channel: "email",
    identifier: toEmail,
  };
}

function buildBulletList(items = []) {
  if (!items.length) {
    return "";
  }

  return items.map((item) => `<li style="margin-bottom:8px;">${item}</li>`).join("");
}

function buildPlainBulletList(items = []) {
  if (!items.length) {
    return "";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

async function sendBookingNotificationEmail({
  toEmail,
  userName,
  subject,
  title,
  intro,
  items = [],
  actionText = "Open booking",
  actionUrl = `${env.appUrl}/bookings`,
}) {
  const text = [
    `Hi ${userName || "there"},`,
    "",
    intro,
    "",
    buildPlainBulletList(items),
    "",
    `${actionText}: ${actionUrl}`,
    "",
    `Thanks,`,
    env.businessName,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827;">
      <h2 style="margin-bottom:8px;">${env.businessName} ${title}</h2>
      <p style="margin:0 0 16px;">Hi ${userName || "there"},</p>
      <p style="margin:0 0 16px;">${intro}</p>
      ${
        items.length
          ? `<ul style="margin:0 0 18px;padding-left:18px;color:#374151;">${buildBulletList(items)}</ul>`
          : ""
      }
      <p style="margin:18px 0;">
        <a href="${actionUrl}" style="display:inline-block;background:#d66b2d;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;">
          ${actionText}
        </a>
      </p>
      <p style="margin:24px 0 0;color:#6b7280;">Thanks,<br />${env.businessName}</p>
    </div>
  `;

  await sendEmailMessage({
    toEmail,
    subject,
    text,
    html,
  });
}

function isEmailOtpConfigured() {
  return isEmailServiceConfigured();
}

export {
  isEmailOtpConfigured,
  isEmailServiceConfigured,
  sendBookingNotificationEmail,
  sendEmailMessage,
  sendOtpEmail,
};
