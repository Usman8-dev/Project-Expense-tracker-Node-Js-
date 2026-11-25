const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html, text }) => {
  const host = (process.env.MAIL_HOST || "smtp-relay.brevo.com").trim();
  const port = Number(process.env.MAIL_PORT) || 587;
  const encryption = (process.env.MAIL_ENCRYPTION || "tls").trim().toLowerCase();
  const user = (process.env.MAIL_USERNAME || "").trim();
  const pass = (process.env.MAIL_PASSWORD || "").trim();
  const fromName = (process.env.MAIL_FROM_NAME || "Expense Flow").trim();
  const fromAddress = (process.env.MAIL_FROM_ADDRESS || "").trim();

  if (!user || !pass || !fromAddress) {
    throw new Error("Mail configuration is incomplete (MAIL_USERNAME, MAIL_PASSWORD, or MAIL_FROM_ADDRESS missing).");
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
