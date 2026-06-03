// utils/sendEmail.js
const nodemailer = require("nodemailer");

// Configure transporter (using Gmail SMTP or your custom SMTP)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // your email
    pass: process.env.EMAIL_PASS, // app password
  },
});

const sendEmail = async (to, subject, text, html = null) => {
  try {
    await transporter.sendMail({
      from: `"Preciva App" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: html || text,
    });
    console.log(`📧 Email sent to ${to}: ${subject} `);
  } catch (err) {
    console.error("❌ Error sending email:", err.message);
  }
};

module.exports = sendEmail;
