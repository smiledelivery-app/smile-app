import { createApiClient } from '@makanza/mobile-core';
import { mobileEnv } from '../config/env';

export const api=createApiClient(mobileEnv.apiUrl);
