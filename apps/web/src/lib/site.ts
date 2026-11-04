const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://smile.delivery';

export const siteUrl = new URL(siteOrigin);
