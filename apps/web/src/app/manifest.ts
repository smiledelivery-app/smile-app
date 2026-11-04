import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Smile — good food, on your time',
    short_name: 'Smile',
    description: 'Discover local kitchens and everyday essentials around you.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffdc3f',
    icons: [
      {
        src: '/smile-logo.png',
        sizes: '1024x1024',
        type: 'image/png',
      },
    ],
  };
}
