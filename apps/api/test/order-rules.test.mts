import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { calculateOrderAmounts, canVendorTransition } from '../src/order-rules.ts';
import { canAccessDemoFeatures, catalogSource, shouldUseMockCheckout } from '../src/catalog-rules.ts';
import { distanceKm, nearestEligibleRiders, rankRidersByRoadDistance } from '../src/dispatch-rules.ts';
import { computeDrivingDistances, computeDrivingRoute, geocodeAddress, GoogleMapsError } from '../src/google-maps.ts';
import { createProofCode } from '../src/proof-codes.ts';
import { initializePaystackTransaction, verifyPaystackSignature } from '../src/paystack.ts';

test('vendor order transitions allow only the intended forward steps',()=>{
  assert.equal(canVendorTransition('CONFIRMED','ACCEPTED_BY_VENDOR'),true);
  assert.equal(canVendorTransition('CONFIRMED','REJECTED'),true);
  assert.equal(canVendorTransition('ACCEPTED_BY_VENDOR','PREPARING'),true);
  assert.equal(canVendorTransition('PREPARING','READY_FOR_PICKUP'),true);
  assert.equal(canVendorTransition('DELIVERED','PREPARING'),false);
  assert.equal(canVendorTransition('CONFIRMED','DELIVERED'),false);
});

test('checkout uses integer minor units and calculates totals without floats',()=>{
  assert.deepEqual(calculateOrderAmounts([{priceMinor:450_000,quantity:2},{priceMinor:125_000,quantity:1}],80_000),{subtotalMinor:1_025_000,totalMinor:1_105_000});
});

test('checkout rejects invalid lines and totals outside the database integer range',()=>{
  assert.throws(()=>calculateOrderAmounts([{priceMinor:100,quantity:0}],80),RangeError);
  assert.throws(()=>calculateOrderAmounts([{priceMinor:2_000_000_000,quantity:2}],80),RangeError);
});

test('checkout multiplies per-item addon quantities and menu item quantities in integer minor units',()=>{
  assert.deepEqual(calculateOrderAmounts([{priceMinor:50_000,quantity:2,addons:[{priceMinor:50_000,quantity:2}]}],80_000),{subtotalMinor:300_000,totalMinor:380_000});
  assert.throws(()=>calculateOrderAmounts([{priceMinor:50_000,quantity:1,addons:[{priceMinor:0,quantity:1}]}],80),RangeError);
});

test('only the Smile test account accesses demo features outside production, independent of global demo mode',()=>{
  assert.equal(canAccessDemoFeatures('smile@gmail.com',true,'staging'),true);
  assert.equal(canAccessDemoFeatures('smile@gmail.com',true,undefined),true);
  assert.equal(canAccessDemoFeatures('other@example.com',true,'staging'),false);
  assert.equal(canAccessDemoFeatures('smile@gmail.com',false,'staging'),false);
  assert.equal(canAccessDemoFeatures('smile@gmail.com',true,'production'),false);
  assert.equal(catalogSource(true),'development-demo');
  assert.equal(catalogSource(false),'database');
  assert.equal(shouldUseMockCheckout(true,true),true);
  assert.equal(shouldUseMockCheckout(true,false),false);
  assert.equal(shouldUseMockCheckout(false,true),false);
});

test('rider dispatch uses pickup proximity, service area, prior offers, and nearest-first limits',()=>{
  const origin={latitude:6.4474,longitude:3.4723};
  const riders=[
    {id:'near',latitude:6.4500,longitude:3.4700,serviceArea:'Lagos'},
    {id:'far',latitude:6.5000,longitude:3.5000,serviceArea:'Lagos'},
    {id:'wrong-area',latitude:6.4475,longitude:3.4724,serviceArea:'Abuja'},
    {id:'already-offered',latitude:6.4475,longitude:3.4724,serviceArea:'Lagos'}
  ];
  const selected=nearestEligibleRiders(riders,origin,'lagos',new Set(['already-offered']),12,1);
  assert.deepEqual(selected.map(rider=>rider.id),['near']);
  assert.ok(distanceKm(6.4474,3.4723,6.4500,3.4700)<1);
  assert.equal(nearestEligibleRiders(riders,origin,'Lagos',new Set(),0.1).length,1);
});

test('road distance ranking uses route distances, excludes unreachable or over-radius riders, and caps offers',()=>{
  const candidates=[{id:'a'},{id:'b'},{id:'c'},{id:'no-route'}];
  const ranked=rankRidersByRoadDistance(candidates,new Map([['a',5.2],['b',2.4],['c',13]]),12,1);
  assert.deepEqual(ranked,[{id:'b',pickupDistanceKm:2.4}]);
});

test('vendor pickup and customer delivery proof codes are stable per delivery and purpose-separated',()=>{
  const pickup=createProofCode('server-secret','vendor-pickup','delivery-123');
  const customer=createProofCode('server-secret','customer-delivery','delivery-123');
  assert.match(pickup,/^\d{6}$/);assert.match(customer,/^\d{6}$/);
  assert.equal(pickup,createProofCode('server-secret','vendor-pickup','delivery-123'));
  assert.notEqual(pickup,customer);
});

test('Google Routes matrix adapter requests only fields it consumes and maps rider origin indexes',async()=>{
  let requestUrl='';let requestHeaders:HeadersInit|undefined;let requestBody='';
  const fakeFetch:typeof fetch=async(input,init)=>{requestUrl=String(input);requestHeaders=init?.headers;requestBody=String(init?.body);return new Response(JSON.stringify([
    {originIndex:0,destinationIndex:0,status:{code:0},condition:'ROUTE_EXISTS',distanceMeters:2400,duration:'400s'},
    {originIndex:1,destinationIndex:0,status:{code:0},condition:'ROUTE_NOT_FOUND'}
  ]),{status:200,headers:{'content-type':'application/json'}});};
  const result=await computeDrivingDistances([{id:'rider-one',coordinate:{latitude:6.5,longitude:3.4}},{id:'rider-two',coordinate:{latitude:6.6,longitude:3.5}}],{latitude:6.4,longitude:3.3},'test-key',fakeFetch);
  assert.equal(requestUrl,'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix');
  assert.equal(new Headers(requestHeaders).get('X-Goog-Api-Key'),'test-key');
  assert.match(new Headers(requestHeaders).get('X-Goog-FieldMask')??'',/distanceMeters/);
  assert.match(requestBody,/"travelMode":"DRIVE"/);
  assert.deepEqual(result.get('rider-one'),{distanceMeters:2400,durationSeconds:400});
  assert.equal(result.has('rider-two'),false);
});

test('Google Maps route and geocode adapters return route and pin data without exposing provider secrets',async()=>{
  const fakeFetch:typeof fetch=async(input)=>{
    const url=String(input);
    if(url.includes('geocode.googleapis.com'))return new Response(JSON.stringify({results:[{location:{latitude:6.52,longitude:3.37},placeId:'place'}]}),{status:200});
    return new Response(JSON.stringify({routes:[{distanceMeters:3400,duration:'600s',polyline:{encodedPolyline:'abc'}}]}),{status:200});
  };
  assert.deepEqual(await computeDrivingRoute({latitude:6.5,longitude:3.4},{latitude:6.52,longitude:3.37},'test-key',fakeFetch),{distanceMeters:3400,durationSeconds:600,encodedPolyline:'abc'});
  assert.deepEqual(await geocodeAddress('Lagos, Nigeria','test-key',fakeFetch),{latitude:6.52,longitude:3.37,placeId:'place'});
  await assert.rejects(()=>computeDrivingDistances([{id:'a',coordinate:{latitude:0,longitude:0}}],{latitude:0,longitude:0},'',fakeFetch),GoogleMapsError);
});

test('Paystack webhook signatures use SHA-512 HMAC and reject altered bodies',()=>{
  const secret='paystack-test-secret';const body=Buffer.from('{"event":"charge.success"}');
  const signature=createHmac('sha512',secret).update(body).digest('hex');
  assert.equal(verifyPaystackSignature(body,signature,secret),true);
  assert.equal(verifyPaystackSignature(Buffer.from('{"event":"charge.failed"}'),signature,secret),false);
});

test('Paystack initialization preserves kobo amount and opaque metadata',async()=>{
  let body='';const fakeFetch:typeof fetch=async(_input,init)=>{body=String(init?.body);return new Response(JSON.stringify({status:true,data:{authorization_url:'https://checkout.example',access_code:'access',reference:'reference'}}),{status:200,headers:{'content-type':'application/json'}});};
  const result=await initializePaystackTransaction({email:'customer@example.com',amountMinor:125_000,reference:'reference',metadata:{purpose:'wallet_topup',userId:'user'}},'secret',fakeFetch);
  assert.deepEqual(result,{authorizationUrl:'https://checkout.example',accessCode:'access',reference:'reference'});
  assert.match(body,/"amount":125000/);assert.match(body,/"wallet_topup"/);
});
