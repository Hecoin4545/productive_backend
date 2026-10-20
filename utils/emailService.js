const nodemailer = require('nodemailer');
const crypto = require('crypto');

/**
 * Generate a cryptographically secure 6-digit OTP string.
 */
function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Creates and configures the Nodemailer transporter using environment variables.
 */
function createTransporter() {
  const { EMAIL_SERVICE, EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    return null;
  }

  if (EMAIL_HOST) {
    return nodemailer.createTransport({
      host: EMAIL_HOST,
      port: parseInt(EMAIL_PORT, 10) || 587,
      secure: EMAIL_SECURE === 'true' || EMAIL_PORT === '465',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
      }
    });
  }

  // Default to service-based configuration (e.g., Gmail)
  return nodemailer.createTransport({
    service: EMAIL_SERVICE || 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });
}

/**
 * Send the 6-digit verification code to the user's email.
 * @param {string} email - Destination email address
 * @param {string} otp - 6-digit code
 * @param {string} [name] - User's name
 */
async function sendVerificationEmail(email, otp, name = '') {
  // Always log clearly to server console for testing/development
  console.log('\n======================================================');
  console.log(' [ARCSTEP EMAIL VERIFICATION]');
  console.log(` Recipient : ${email}`);
  if (name) console.log(` Name      : ${name}`);
  console.log(` Code (OTP): >>> ${otp} <<<`);
  console.log(' Valid for : 10 minutes');
  console.log('======================================================\n');

  const transporter = createTransporter();

  // If email credentials are not yet configured in .env, permit testing via console
  if (!transporter) {
    console.warn(
      '[EMAIL SERVICE WARNING] EMAIL_USER / EMAIL_PASS are not configured in .env. Email was NOT sent over network, but OTP code is printed above for local testing.'
    );
    return { success: true, simulated: true };
  }

  const senderEmail = process.env.EMAIL_FROM || `"Arcstep" <${process.env.EMAIL_USER}>`;
  const greeting = name ? `Hi ${name},` : 'Hello,';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Arcstep Verification Code</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0f1117;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
    }
    .wrapper {
      max-width: 540px;
      margin: 40px auto;
      background: #181b24;
      border: 1px solid #282d3d;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .header {
      padding: 32px 32px 20px;
      text-align: center;
      background: linear-gradient(180deg, #1f2433 0%, #181b24 100%);
      border-bottom: 1px solid #282d3d;
    }
    .logo {
      display: inline-block;
      width: 44px;
      height: 44px;
      line-height: 44px;
      background: #2563eb;
      color: #ffffff;
      font-weight: 800;
      font-size: 22px;
      border-radius: 12px;
      margin-bottom: 12px;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
    }
    .brand-name {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #ffffff;
    }
    .content {
      padding: 32px;
    }
    .greeting {
      font-size: 16px;
      color: #cbd5e1;
      margin-bottom: 16px;
    }
    .lead-text {
      font-size: 15px;
      line-height: 1.6;
      color: #94a3b8;
      margin-bottom: 28px;
    }
    .code-container {
      background: #0f1117;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin-bottom: 28px;
    }
    .code-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #64748b;
      margin-bottom: 10px;
    }
    .otp-code {
      font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      font-size: 38px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #38bdf8;
      display: inline-block;
      padding: 4px 12px;
    }
    .expiry-note {
      font-size: 13px;
      color: #64748b;
      text-align: center;
      margin-bottom: 24px;
    }
    .security-notice {
      background: rgba(30, 41, 59, 0.5);
      border-left: 3px solid #38bdf8;
      padding: 12px 16px;
      border-radius: 4px;
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.5;
    }
    .footer {
      padding: 20px 32px;
      text-align: center;
      border-top: 1px solid #282d3d;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">A</div>
      <h1 class="brand-name">Arcstep</h1>
    </div>
    <div class="content">
      <p class="greeting">${greeting}</p>
      <p class="lead-text">
        Welcome to Arcstep! To verify your email address and complete your account creation, please enter the following 6-digit verification code:
      </p>
      <div class="code-container">
        <div class="code-label">Verification Code</div>
        <div class="otp-code">${otp}</div>
      </div>
      <p class="expiry-note">⏱ This code is valid for <strong>10 minutes</strong>.</p>
      <div class="security-notice">
        If you did not request this email, please ignore it or contact support. Never share this code with anyone.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Arcstep. Empowering your learning workflow.
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
Arcstep - Verification Code

${greeting}

Use the following 6-digit verification code to complete your Arcstep account signup:

${otp}

This code will expire in 10 minutes.
If you did not request this verification, please safely ignore this email.
`;

  try {
    const info = await transporter.sendMail({
      from: senderEmail,
      to: email,
      subject: `${otp} is your Arcstep verification code`,
      text: textContent,
      html: htmlContent
    });
    console.log(`[EMAIL SERVICE] Verification email sent to ${email} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL SERVICE ERROR] Failed to send email via SMTP:', error);
    throw error;
  }
}

module.exports = {
  generateOTP,
  sendVerificationEmail
};
