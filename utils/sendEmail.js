const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html, text }) => {
  const fromName = (process.env.MAIL_FROM_NAME || "Expense Flow").trim();
  const fromAddress = (process.env.MAIL_FROM_ADDRESS || "").trim();
  const brevoApiKey = (
    process.env.BREVO_API_KEY ||
    (process.env.MAIL_PASSWORD && process.env.MAIL_PASSWORD.trim().startsWith("xkeysib-")
      ? process.env.MAIL_PASSWORD
      : "")
  ).trim();

  if (!fromAddress) {
    throw new Error("MAIL_FROM_ADDRESS is missing.");
  }

  // Use Brevo HTTP API over HTTPS (port 443) when BREVO_API_KEY is available.
  // Render Free Tier blocks outbound SMTP ports (25, 465, 587), so HTTPS API is required in production.
  if (brevoApiKey) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromAddress },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brevo API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  // Fallback to SMTP (for local development where SMTP ports are open)
  const host = (process.env.MAIL_HOST || "smtp-relay.brevo.com").trim();
  const port = Number(process.env.MAIL_PORT) || 587;
  const encryption = (process.env.MAIL_ENCRYPTION || "tls").trim().toLowerCase();
  const user = (process.env.MAIL_USERNAME || "").trim();
  const pass = (process.env.MAIL_PASSWORD || "").trim();

  if (!user || !pass) {
    throw new Error("Mail configuration is incomplete (BREVO_API_KEY or MAIL_USERNAME/MAIL_PASSWORD missing).");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: encryption === "tls",
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    text,
    html,
  });
};

module.exports = sendEmail;
