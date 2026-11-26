import { createHash } from 'node:crypto';

export function riderPiiEncryptionKey(env: NodeJS.ProcessEnv = process.env) {
  const dedicatedKey = env.RIDER_PII_ENCRYPTION_KEY?.trim();
  const accessSecret = env.JWT_ACCESS_SECRET?.trim();
  const secret = dedicatedKey && dedicatedKey.length >= 32 ? dedicatedKey : accessSecret;

  if (!secret || secret.length < 32) {
    throw new Error('RIDER_PII_ENCRYPTION_KEY must be configured with at least 32 characters.');
  }

  return createHash('sha256').update(secret).digest();
}
