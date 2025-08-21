// api/send-email.js —— CommonJS 版本（Vercel Functions）
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, message, honeypot } = req.body || {};
    if (honeypot) return res.status(200).json({ ok: true }); // 蜜罐：机器人直接吃掉
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_PORT) === '465', // 465 用 SSL
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"Website Contact" <${process.env.MAIL_FROM}>`,
      to: process.env.MAIL_TO,
      replyTo: email,
      subject: `New message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html: `
        <h3>New Website Message</h3>
        <p><b>Name:</b> ${escapeHtml(name)}</p>
        <p><b>Email:</b> ${escapeHtml(email)}</p>
        <p><b>Message:</b></p>
        <p>${escapeHtml(message).replace(/\n/g,'<br>')}</p>
      `,
    });

    // 2) 自动回复给访客（避免和系统地址互相循环）
    const lower = userEmail.toLowerCase();
    const deny = ['postmaster', 'mailer-daemon', 'bounce', 'no-reply', 'noreply'];
    const safeToAutoReply =
      lower &&
      ![String(process.env.MAIL_TO || '').toLowerCase(),
        String(process.env.MAIL_FROM || '').toLowerCase()].includes(lower) &&
      !deny.some(k => lower.includes(k));

    if (safeToAutoReply) {
      await transporter.sendMail({
        from: `"赛格鞋业 SAIGE Footwear" <${process.env.MAIL_FROM}>`,
        to: userEmail,
        replyTo: process.env.MAIL_TO, // 访客点“回复”会回到你们的收件箱
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
      });
    }
    
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: 'Email send failed' });
  }
};

function escapeHtml(str=''){
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
