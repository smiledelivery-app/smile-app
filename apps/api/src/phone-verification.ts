import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export type PhoneVerificationChannel = 'sms' | 'whatsapp';

type ProviderResponse = { pinId?: string; verified?: boolean; status?: string; message?: string };

export class PhoneVerificationError extends Error {
  constructor(message: string, readonly status = 502) { super(message); this.name = 'PhoneVerificationError'; }
}

function infobipSettings() {
  const baseUrl = process.env.INFOBIP_BASE_URL?.trim().replace(/\/$/, '');
  const apiKey = process.env.INFOBIP_API_KEY?.trim();
  const applicationId = process.env.INFOBIP_2FA_APPLICATION_ID?.trim();
  const messageId = process.env.INFOBIP_2FA_MESSAGE_ID?.trim();
  const sender = process.env.INFOBIP_2FA_SENDER?.trim();
  const missing = [!baseUrl && 'INFOBIP_BASE_URL', !apiKey && 'INFOBIP_API_KEY', !applicationId && 'INFOBIP_2FA_APPLICATION_ID', !messageId && 'INFOBIP_2FA_MESSAGE_ID', !sender && 'INFOBIP_2FA_SENDER'].filter(Boolean);
  if (missing.length) throw new PhoneVerificationError(`Phone verification is missing server configuration: ${missing.join(', ')}.`, 503);
  if (!/^https:\/\//i.test(baseUrl!)) throw new PhoneVerificationError('INFOBIP_BASE_URL must be an HTTPS API base URL.', 503);
  return { baseUrl: baseUrl!, apiKey: apiKey!, applicationId: applicationId!, messageId: messageId!, sender: sender! };
}

function whatsappSettings() {
  const baseUrl = process.env.INFOBIP_BASE_URL?.trim().replace(/\/$/, '');
  const apiKey = process.env.INFOBIP_API_KEY?.trim();
  const sender = process.env.INFOBIP_WHATSAPP_SENDER?.trim();
  const templateName = process.env.INFOBIP_WHATSAPP_TEMPLATE_NAME?.trim();
  const language = process.env.INFOBIP_WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en';
  const missing = [!baseUrl && 'INFOBIP_BASE_URL', !apiKey && 'INFOBIP_API_KEY', !sender && 'INFOBIP_WHATSAPP_SENDER', !templateName && 'INFOBIP_WHATSAPP_TEMPLATE_NAME'].filter(Boolean);
  if (missing.length) throw new PhoneVerificationError(`WhatsApp verification is missing server configuration: ${missing.join(', ')}.`, 503);
  if (!/^https:\/\//i.test(baseUrl!)) throw new PhoneVerificationError('INFOBIP_BASE_URL must be an HTTPS API base URL.', 503);
  return { baseUrl: baseUrl!, apiKey: apiKey!, sender: sender!, templateName: templateName!, language };
}

async function sendWhatsAppVerification(phone: string): Promise<string> {
  const config = whatsappSettings();
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const response = await fetch(`${config.baseUrl}/whatsapp/1/message/template`, {
    method: 'POST',
    headers: { authorization: `App ${config.apiKey}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ messages: [{
      from: config.sender,
      to: phone.replace(/^\+/, ''),
      content: { templateName: config.templateName, templateData: { body: { placeholders: [code] } }, language: config.language },
    }] }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new PhoneVerificationError('Infobip could not send the WhatsApp verification code. Check the approved authentication template and sender.');
  const digest = createHmac('sha256', config.apiKey).update(`${phone}:${code}`).digest('hex');
  return `whatsapp:${digest}`;
}

async function infobipRequest(path: string, payload: Record<string, string>, fetcher: typeof fetch = fetch): Promise<ProviderResponse> {
  const config = infobipSettings();
  const response = await fetcher(`${config.baseUrl}${path}`, {
    method: 'POST',
    headers: { authorization: `App ${config.apiKey}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => null) as ProviderResponse | null;
  if (!response.ok) throw new PhoneVerificationError('Infobip could not complete phone verification. Check the number and your Infobip 2FA setup.');
  return body ?? {};
}

export async function sendPhoneVerification(phone: string, channel: PhoneVerificationChannel): Promise<string> {
  if (channel === 'whatsapp') return sendWhatsAppVerification(phone);
  const config = infobipSettings();
  const response = await infobipRequest('/2fa/2/pin', {
    applicationId: config.applicationId, messageId: config.messageId, from: config.sender, to: phone.replace(/^\+/, ''),
  });
  if (!response.pinId) throw new PhoneVerificationError('Infobip did not return a verification reference. Check your 2FA application and message template.');
  return response.pinId;
}

export async function checkPhoneVerification(pinId: string, phone: string, code: string): Promise<boolean> {
  if (!pinId) return false;
  if (pinId.startsWith('whatsapp:')) {
    const config = whatsappSettings();
    const storedDigest = Buffer.from(pinId.slice('whatsapp:'.length));
    const phoneAndCodeDigest = Buffer.from(createHmac('sha256', config.apiKey).update(`${phone}:${code}`).digest('hex'));
    return storedDigest.length === phoneAndCodeDigest.length && timingSafeEqual(storedDigest, phoneAndCodeDigest);
  }
  const response = await infobipRequest(`/2fa/2/pin/${encodeURIComponent(pinId)}/verify`, { pin: code });
  return response.verified === true;
}
