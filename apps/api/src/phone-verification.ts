import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export type PhoneVerificationChannel = 'sms' | 'whatsapp';

type ProviderResponse = { pinId?: string; verified?: boolean; status?: string; message?: string };
type WhatsAppProviderResponse = {
  messages?: Array<{ messageId?: string; status?: { groupName?: string } }>;
  requestError?: { serviceException?: { messageId?: string } };
};

export class PhoneVerificationError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) { super(message); this.status = status; this.name = 'PhoneVerificationError'; }
}

function infobipBaseUrl(): string {
  const value = process.env.INFOBIP_BASE_URL?.trim();
  if (!value) throw new PhoneVerificationError('Phone verification is missing server configuration: INFOBIP_BASE_URL.', 503);
  let url: URL;
  try { url = new URL(value); }
  catch { throw new PhoneVerificationError('INFOBIP_BASE_URL must be the HTTPS API base URL from Infobip.', 503); }
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
    throw new PhoneVerificationError('INFOBIP_BASE_URL must be the HTTPS API hostname from Infobip, without a path.', 503);
  }
  return url.origin;
}

function infobipSettings() {
  const baseUrl = infobipBaseUrl();
  const apiKey = process.env.INFOBIP_API_KEY?.trim();
  const applicationId = process.env.INFOBIP_2FA_APPLICATION_ID?.trim();
  const messageId = process.env.INFOBIP_2FA_MESSAGE_ID?.trim();
  const sender = process.env.INFOBIP_2FA_SENDER?.trim();
  const missing = [!apiKey && 'INFOBIP_API_KEY', !applicationId && 'INFOBIP_2FA_APPLICATION_ID', !messageId && 'INFOBIP_2FA_MESSAGE_ID', !sender && 'INFOBIP_2FA_SENDER'].filter(Boolean);
  if (missing.length) throw new PhoneVerificationError(`Phone verification is missing server configuration: ${missing.join(', ')}.`, 503);
  return { baseUrl, apiKey: apiKey!, applicationId: applicationId!, messageId: messageId!, sender: sender! };
}

function whatsappSettings() {
  const baseUrl = infobipBaseUrl();
  const apiKey = process.env.INFOBIP_API_KEY?.trim();
  const sender = process.env.INFOBIP_WHATSAPP_SENDER?.trim();
  const templateName = process.env.INFOBIP_WHATSAPP_TEMPLATE_NAME?.trim();
  const language = process.env.INFOBIP_WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en';
  const missing = [!apiKey && 'INFOBIP_API_KEY', !sender && 'INFOBIP_WHATSAPP_SENDER', !templateName && 'INFOBIP_WHATSAPP_TEMPLATE_NAME'].filter(Boolean);
  if (missing.length) throw new PhoneVerificationError(`WhatsApp verification is missing server configuration: ${missing.join(', ')}.`, 503);
  return { baseUrl, apiKey: apiKey!, sender: sender!, templateName: templateName!, language };
}

function configuredTestCode(): string | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;
  const code = process.env.PHONE_VERIFICATION_TEST_CODE?.trim();
  if (!code) return undefined;
  if (!/^\d{4,10}$/.test(code)) throw new PhoneVerificationError('PHONE_VERIFICATION_TEST_CODE must contain 4 to 10 digits.', 503);
  return code;
}

async function sendWhatsAppVerification(phone: string, fetcher: typeof fetch = fetch): Promise<string> {
  const config = whatsappSettings();
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  let response: Response;
  try {
    response = await fetcher(`${config.baseUrl}/whatsapp/1/message/template`, {
      method: 'POST',
      headers: { authorization: `App ${config.apiKey}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ messages: [{
        from: config.sender.replace(/^\+/, ''),
        to: phone.replace(/^\+/, ''),
        content: {
          templateName: config.templateName,
          templateData: {
            body: { placeholders: [code] },
            buttons: [{ type: 'URL', parameter: code }],
          },
          language: config.language,
        },
      }] }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error(JSON.stringify({ event: 'infobip_whatsapp_transport_error', errorType: error instanceof Error ? error.name : 'unknown' }));
    throw new PhoneVerificationError(timedOut ? 'Infobip WhatsApp request timed out.' : 'Could not reach the Infobip WhatsApp API.');
  }
  const body = await response.json().catch(() => null) as WhatsAppProviderResponse | null;
  if (!response.ok) {
    const errorCode = body?.requestError?.serviceException?.messageId;
    console.error(JSON.stringify({ event: 'infobip_whatsapp_send_rejected', status: response.status, providerErrorCode: errorCode ?? null }));
    throw new PhoneVerificationError(`Infobip rejected the WhatsApp message (HTTP ${response.status}${errorCode ? `, ${errorCode}` : ''}). Check the Infobip message logs and approved template.`);
  }
  const providerMessage = body?.messages?.[0];
  if (!providerMessage?.messageId) {
    console.error(JSON.stringify({ event: 'infobip_whatsapp_send_missing_message_id', status: response.status }));
    throw new PhoneVerificationError('Infobip did not return a WhatsApp message reference. Check the Infobip message logs.');
  }
  const statusGroup = providerMessage.status?.groupName?.toUpperCase();
  if (statusGroup && ['REJECTED', 'UNDELIVERABLE', 'FAILED', 'SKIPPED'].includes(statusGroup)) {
    console.error(JSON.stringify({ event: 'infobip_whatsapp_message_rejected', statusGroup }));
    throw new PhoneVerificationError(`Infobip rejected the WhatsApp message (${statusGroup}). Check the Infobip message logs.`);
  }
  console.info(JSON.stringify({ event: 'infobip_whatsapp_message_accepted', providerMessageId: providerMessage.messageId, statusGroup: statusGroup ?? null }));
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

export async function sendPhoneVerification(phone: string, channel: PhoneVerificationChannel, fetcher: typeof fetch = fetch): Promise<string> {
  if (configuredTestCode()) return 'test-code';
  if (channel === 'whatsapp') return sendWhatsAppVerification(phone, fetcher);
  const config = infobipSettings();
  const response = await infobipRequest('/2fa/2/pin', {
    applicationId: config.applicationId, messageId: config.messageId, from: config.sender, to: phone.replace(/^\+/, ''),
  }, fetcher);
  if (!response.pinId) throw new PhoneVerificationError('Infobip did not return a verification reference. Check your 2FA application and message template.');
  return response.pinId;
}

export async function checkPhoneVerification(pinId: string, phone: string, code: string): Promise<boolean> {
  if (!pinId) return false;
  if (pinId === 'test-code') {
    const expectedCode = configuredTestCode();
    if (!expectedCode) return false;
    const expected = Buffer.from(expectedCode);
    const provided = Buffer.from(code);
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }
  if (pinId.startsWith('whatsapp:')) {
    const config = whatsappSettings();
    const storedDigest = Buffer.from(pinId.slice('whatsapp:'.length));
    const phoneAndCodeDigest = Buffer.from(createHmac('sha256', config.apiKey).update(`${phone}:${code}`).digest('hex'));
    return storedDigest.length === phoneAndCodeDigest.length && timingSafeEqual(storedDigest, phoneAndCodeDigest);
  }
  const response = await infobipRequest(`/2fa/2/pin/${encodeURIComponent(pinId)}/verify`, { pin: code });
  return response.verified === true;
}
