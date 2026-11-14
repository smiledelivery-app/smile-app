import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { checkPhoneVerification, PhoneVerificationError, sendPhoneVerification } from '../src/phone-verification.ts';

const originalNodeEnv = process.env.NODE_ENV;
const originalTestCode = process.env.PHONE_VERIFICATION_TEST_CODE;
const infobipVariables = ['INFOBIP_BASE_URL', 'INFOBIP_API_KEY', 'INFOBIP_WHATSAPP_SENDER', 'INFOBIP_WHATSAPP_TEMPLATE_NAME', 'INFOBIP_WHATSAPP_TEMPLATE_LANGUAGE'];
const originalInfobipValues = new Map(infobipVariables.map(name => [name, process.env[name]]));

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalTestCode === undefined) delete process.env.PHONE_VERIFICATION_TEST_CODE;
  else process.env.PHONE_VERIFICATION_TEST_CODE = originalTestCode;
  for (const [name, value] of originalInfobipValues) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('configured test code verifies phone signup outside production', async () => {
  process.env.NODE_ENV = 'test';
  process.env.PHONE_VERIFICATION_TEST_CODE = '123456';

  const pinId = await sendPhoneVerification('+2348012345678', 'sms');

  assert.equal(pinId, 'test-code');
  assert.equal(await checkPhoneVerification(pinId, '+2348012345678', '123456'), true);
  assert.equal(await checkPhoneVerification(pinId, '+2348012345678', '654321'), false);
});

test('test code is disabled in production', async () => {
  process.env.NODE_ENV = 'production';
  process.env.PHONE_VERIFICATION_TEST_CODE = '123456';

  assert.equal(await checkPhoneVerification('test-code', '+2348012345678', '123456'), false);
});

test('invalid configured test code fails explicitly outside production', async () => {
  process.env.NODE_ENV = 'test';
  process.env.PHONE_VERIFICATION_TEST_CODE = 'not-a-code';

  await assert.rejects(
    sendPhoneVerification('+2348012345678', 'sms'),
    error => error instanceof PhoneVerificationError && error.status === 503,
  );
});

test('WhatsApp signup sends a positional code using the Infobip template API', async () => {
  process.env.NODE_ENV = 'production';
  delete process.env.PHONE_VERIFICATION_TEST_CODE;
  process.env.INFOBIP_BASE_URL = 'https://test.api.infobip.com';
  process.env.INFOBIP_API_KEY = 'test-api-key';
  process.env.INFOBIP_WHATSAPP_SENDER = '+2348000000000';
  process.env.INFOBIP_WHATSAPP_TEMPLATE_NAME = 'smile_verification';
  process.env.INFOBIP_WHATSAPP_TEMPLATE_LANGUAGE = 'en';

  let requestUrl = '';
  let request: RequestInit | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    request = init;
    return Response.json({ messages: [{ messageId: 'message-id', status: { groupName: 'PENDING' } }] });
  };
  const pinId = await sendPhoneVerification('+2348012345678', 'whatsapp', fetcher);

  assert.match(pinId, /^whatsapp:/);
  assert.equal(requestUrl, 'https://test.api.infobip.com/whatsapp/1/message/template');
  assert.equal(new Headers(request?.headers).get('authorization'), 'App test-api-key');
  const payload = JSON.parse(String(request?.body)) as {
    messages: Array<{ from: string; to: string; content: { templateName: string; language: string; templateData: { body: { type: string; placeholders: string[] } } } }>;
  };
  assert.equal(payload.messages[0].from, '2348000000000');
  assert.equal(payload.messages[0].to, '2348012345678');
  assert.equal(payload.messages[0].content.templateName, 'smile_verification');
  assert.equal(payload.messages[0].content.language, 'en');
  assert.equal(payload.messages[0].content.templateData.body.type, 'POSITIONAL_PARAMETERS');
  assert.match(payload.messages[0].content.templateData.body.placeholders[0], /^\d{6}$/);
});
