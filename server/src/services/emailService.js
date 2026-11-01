import { config } from '../config/index.js';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export async function sendOtpEmail({
  to,
  otp,
  purpose = 'email-verification',
}) {
  if (!config.email.brevoApiKey) {
    throw new Error('BREVO_API_KEY is not configured.');
  }

  if (!config.email.senderEmail) {
    throw new Error('BREVO_SENDER_EMAIL is not configured.');
  }

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error('A valid recipient email address is required.');
  }

  if (!/^\d{6}$/.test(String(otp))) {
    throw new Error('OTP must contain exactly six digits.');
  }

  const templates = {
    'email-verification': {
      subject: 'Verify your ProxiSpeak Meet email',
      heading: 'Verify your email address',
      message:
        'Use the verification code below to verify your email address and activate your ProxiSpeak Meet account.',
    },

    'password-reset': {
      subject: 'Your ProxiSpeak Meet password reset code',
      heading: 'Reset your password',
      message:
        'Use the code below to continue resetting your ProxiSpeak Meet password. If you did not request a password reset, you can ignore this email.',
    },
  };

  const template = templates[purpose];

  if (!template) {
    throw new Error('Unsupported OTP email purpose.');
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${template.subject}</title>
      </head>
      <body style="margin:0;padding:0;background:#14161C;font-family:Arial,sans-serif;color:#EAEAE6;">
        <div style="max-width:560px;margin:40px auto;padding:36px 28px;background:#1C1F28;border:1px solid #343744;border-radius:16px;">
          <p style="margin:0 0 12px;color:#CDB5F7;font-size:13px;font-weight:bold;letter-spacing:2px;">
            PROXISPEAK MEET
          </p>

          <h1 style="margin:0 0 16px;font-size:25px;color:#EAEAE6;">
            ${template.heading}
          </h1>

          <p style="margin:0 0 24px;color:#B8BAC5;line-height:1.7;">
            ${template.message}
          </p>

          <div style="padding:22px 12px;background:#14161C;border:1px solid #343744;border-radius:12px;text-align:center;">
            <span style="font-size:34px;font-weight:bold;letter-spacing:9px;color:#CDB5F7;">
              ${otp}
            </span>
          </div>

          <p style="margin:22px 0 0;color:#E5DF98;font-size:14px;">
            This code expires soon. Never share it with anyone.
          </p>

          <p style="margin:28px 0 0;color:#858997;font-size:12px;line-height:1.6;">
            ProxiSpeak Meet · Your virtual workspace for natural conversations.
          </p>
        </div>
      </body>
    </html>
  `;

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': config.email.brevoApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: config.email.senderName,
        email: config.email.senderEmail,
      },
      to: [{ email: to }],
      subject: template.subject,
      htmlContent,
      textContent: [
        'ProxiSpeak Meet',
        '',
        template.heading,
        template.message,
        '',
        `Your verification code is: ${otp}`,
        '',
        'Never share this code with anyone.',
      ].join('\n'),
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const responseText = await response.text();

    // Avoid logging the OTP or API key.
    console.error('Brevo email request failed:', {
      status: response.status,
      response: responseText.slice(0, 500),
    });

    throw new Error('Unable to send the verification email.');
  }

  return { success: true };
}