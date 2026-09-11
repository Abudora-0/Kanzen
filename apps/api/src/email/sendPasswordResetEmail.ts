import { env } from '../env.js';

const RESEND_URL = 'https://api.resend.com/emails';

// Resend's shared onboarding@resend.dev sender works with no domain
// verification, which is the point here: this project has no custom domain
// to verify against.
const FROM = 'Kanzen <onboarding@resend.dev>';

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: 'Reset your Kanzen password',
      html: renderEmail(resetUrl),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend responded ${res.status}: ${body}`);
  }
}

function renderEmail(resetUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Reset your password</h2>
      <p>Someone requested a password reset for your Kanzen account. If this was you, click below to choose a new password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background: #e5533c; color: #fff; text-decoration: none; border-radius: 8px;">Reset password</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;
}
