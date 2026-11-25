const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html, text }) => {
  const port = Number(process.env.MAIL_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp-relay.brevo.com",
    port,
    secure: port === 465,
    requireTLS: process.env.MAIL_ENCRYPTION === "tls",
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  const fromName = process.env.MAIL_FROM_NAME || "Expense Flow";
  const fromAddress = process.env.MAIL_FROM_ADDRESS;

  return transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    text,
    html,
  });
};

module.exports = sendEmail;
