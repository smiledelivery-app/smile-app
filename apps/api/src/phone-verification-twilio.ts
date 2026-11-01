import type { PhoneVerificationChannel } from './phone-verification.js';

type ProviderResponse = { status?: string; message?: string };

export class TwilioPhoneVerificationError extends Error {
  constructor(message: string, readonly status = 502) { super(message); this.name = 'TwilioPhoneVerificationError'; }
}

function settings() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim();
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
  const missing = [!accountSid && 'TWILIO_ACCOUNT_SID', !apiKeySid && 'TWILIO_API_KEY_SID', !apiKeySecret && 'TWILIO_API_KEY_SECRET', !serviceSid && 'TWILIO_VERIFY_SERVICE_SID'].filter(Boolean);
  if (missing.length) throw new TwilioPhoneVerificationError(`Twilio Verify is missing configuration: ${missing.join(', ')}.`, 503);
  return { accountSid: accountSid!, apiKeySid: apiKeySid!, apiKeySecret: apiKeySecret!, serviceSid: serviceSid! };
}

async function callTwilio(path: string, params: URLSearchParams, fetcher: typeof fetch = fetch): Promise<ProviderResponse> {
  const config = settings();
  const response = await fetcher(`https://verify.twilio.com/v2/Services/${encodeURIComponent(config.serviceSid)}/${path}`, {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${config.apiKeySid}:${config.apiKeySecret}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(), signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => null) as ProviderResponse | null;
  if (!response.ok) throw new TwilioPhoneVerificationError('Twilio Verify could not complete the request.');
  return body ?? {};
}

// Kept available for an intentional provider switch; signup currently calls Infobip instead.
export async function sendPhoneVerificationWithTwilio(phone: string, channel: PhoneVerificationChannel): Promise<void> {
  await callTwilio('Verifications', new URLSearchParams({ To: phone, Channel: channel }));
}

export async function checkPhoneVerificationWithTwilio(phone: string, code: string): Promise<boolean> {
  const response = await callTwilio('VerificationCheck', new URLSearchParams({ To: phone, Code: code }));
  return response.status === 'approved';
}
