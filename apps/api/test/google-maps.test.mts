import assert from 'node:assert/strict';
import { test } from 'node:test';
import { autocompletePlaces, GoogleMapsError, resolvePlace } from '../src/google-maps.ts';

test('place autocomplete restricts results to Nigeria and returns only usable predictions', async () => {
  let request: RequestInit | undefined;
  const fetcher: typeof fetch = async (_input, init) => {
    request = init;
    return Response.json({
      suggestions: [
        { placePrediction: { placeId: 'ng-place', text: { text: 'Lekki, Lagos, Nigeria' } } },
        { queryPrediction: { text: { text: 'ignored prediction' } } },
      ],
    });
  };

  assert.deepEqual(await autocompletePlaces('Lekki', 'test-key', fetcher), [
    { placeId: 'ng-place', description: 'Lekki, Lagos, Nigeria' },
  ]);
  assert.deepEqual(JSON.parse(String(request?.body)), {
    input: 'Lekki',
    includedRegionCodes: ['ng'],
    languageCode: 'en',
  });
  assert.equal(new Headers(request?.headers).get('X-Goog-Api-Key'), 'test-key');
});

test('place resolution returns coordinates and rejects places outside Nigeria', async () => {
  const fetcher: typeof fetch = async () => Response.json({
    formattedAddress: '12 Admiralty Way, Lekki, Nigeria',
    location: { latitude: 6.45, longitude: 3.47 },
    addressComponents: [
      { longText: '12', types: ['street_number'] },
      { longText: 'Admiralty Way', types: ['route'] },
      { longText: 'Lekki', types: ['locality'] },
      { shortText: 'NG', types: ['country'] },
    ],
  });
  assert.deepEqual(await resolvePlace('ng-place', 'test-key', fetcher), {
    line1: '12 Admiralty Way',
    city: 'Lekki',
    latitude: 6.45,
    longitude: 3.47,
  });

  await assert.rejects(
    resolvePlace('foreign-place', 'test-key', async () => Response.json({
      location: { latitude: 6.45, longitude: 3.47 },
      addressComponents: [{ shortText: 'BJ', types: ['country'] }],
    })),
    error => error instanceof GoogleMapsError && error.message === 'Choose a location in Nigeria.',
  );
});
