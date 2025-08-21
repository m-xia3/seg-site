// api/send-email.js — 带自动回复（修正版）
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, message, honeypot } = req.body || {};

    // 反机器人：蜜罐被填直接吞
    if (honeypot) return res.status(200).json({ ok: true });

    // 基本校验
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const userEmail = String(email).trim();                   // ← 补上
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail);
    if (!emailOk) return res.status(400).json({ error: 'Invalid email' });

    // SMTP 连接
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_PORT) === '465',        // 465 用 SSL
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    // 1) 发给你们内部
    await transporter.sendMail({
      from: `"Website Contact" <${process.env.MAIL_FROM}>`,
      to: process.env.MAIL_TO,
      replyTo: userEmail,                                     // 用校验后的
      subject: `New message from ${name}`,
      text: `Name: ${name}\nEmail: ${userEmail}\n\n${message}`,
      html: `
        <h3>New Website Message</h3>
        <p><b>Name:</b> ${escapeHtml(name)}</p>
        <p><b>Email:</b> ${escapeHtml(userEmail)}</p>
        <p><b>Message:</b></p>
        <p>${escapeHtml(message).replace(/\n/g,'<br>')}</p>
      `,
    });

    // 2) 自动回复（失败也不影响主流程）
    const lower = userEmail.toLowerCase();
    const deny = ['postmaster', 'mailer-daemon', 'bounce', 'no-reply', 'noreply'];
    const safeToAutoReply =
      lower &&
      ![String(process.env.MAIL_TO || '').toLowerCase(),
        String(process.env.MAIL_FROM || '').toLowerCase()].includes(lower) &&
      !deny.some(k => lower.includes(k));

    if (safeToAutoReply) {
      transporter.sendMail({
        from: `"赛格鞋业 SAIGE Footwear" <${process.env.MAIL_FROM}>`,
        to: userEmail,
        replyTo: process.env.MAIL_TO,
        subject: '我们已收到您的来信 | We received your message',
        text:
`您好 ${name}：
感谢您的来信！我们已收到，并会在 24–48 小时内回复您。

— 赛格鞋业 SAIGE Footwear`,
        html: `
          <p>您好 ${escapeHtml(name)}：</p>
          <p>感谢您的来信！我们已收到，并会在 <b>24–48 小时</b> 内回复您。</p>
          <p>— 赛格鞋业 SAIGE Footwear</p>
        `
      }).catch(err => console.error('auto-reply error:', err));
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: 'Email send failed' });
  }
};

// 简单 XSS 处理
function escapeHtml(str=''){
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
