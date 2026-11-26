import test from 'node:test';
import assert from 'node:assert/strict';
import { riderApplicationInput } from '../src/rider-application.ts';

// The payload the operations app sends once every field, including the photo, is filled.
const application=()=>({
  vehicleType:'MOTORCYCLE',serviceArea:'Idigba, Ilorin',dateOfBirth:'1999-04-15',nin:'12345678901',
  ninDocumentPublicId:'smile/riders/user-1/identity/nin-1794000000000.jpg',ninDocumentVersion:1794000000,ninDocumentName:'NIN slip.jpg',
  profileImagePublicId:'smile/riders/user-1/profile/rider-profile-1794000000000',profileImageUrl:'https://res.cloudinary.com/smile/image/upload/v1794000000000/smile/riders/user-1/profile/rider-profile-1794000000000.jpg',
  plateNumber:'ABC 123 XY',residentialAddress:'20, Idigba, Ilorin',
  guarantorName:'Amina Yusuf',guarantorNin:'12345678901',guarantorAddress:'20, Idigba, Ilorin',
  accountNumber:'0123456789',bankCode:'044',termsAccepted:true,
});

test('a complete rider application with a profile photo is accepted',()=>{
  const parsed=riderApplicationInput.safeParse(application());
  assert.equal(parsed.success,true);
  // Only known fields are kept; the display name the app sends for the NIN copy is dropped.
  if(parsed.success)assert.equal('ninDocumentName' in parsed.data,false);
});

test('a rider application can be submitted before payout details are verified',()=>{
  const {accountNumber,bankCode,...withoutPayout}=application();
  const parsed=riderApplicationInput.safeParse(withoutPayout);
  assert.equal(parsed.success,true);
  if(parsed.success){
    assert.equal(parsed.data.accountNumber,'');
    assert.equal(parsed.data.bankCode,'');
  }
  assert.equal(riderApplicationInput.safeParse({...application(),accountNumber:'0123'}).success,true);
});

test('a rider application without a valid profile photo is rejected',()=>{
  // Earlier app builds left the photo fields as empty strings when no photo was chosen.
  for(const photo of [undefined,'']){
    const parsed=riderApplicationInput.safeParse({...application(),profileImagePublicId:photo,profileImageUrl:photo});
    assert.equal(parsed.success,false);
    if(!parsed.success)assert.ok(parsed.error.issues.some(issue=>issue.path[0]==='profileImagePublicId'));
  }
  const withoutPhoto=(({profileImagePublicId,profileImageUrl,...rest})=>rest)(application());
  assert.equal(riderApplicationInput.safeParse(withoutPhoto).success,false);
  assert.equal(riderApplicationInput.safeParse({...application(),profileImagePublicId:'not-an-upload'}).success,false);
  assert.equal(riderApplicationInput.safeParse({...application(),profileImageUrl:'not-a-url'}).success,false);
});

test('motorised vehicles need a plate number and a bicycle may leave it blank',()=>{
  assert.equal(riderApplicationInput.safeParse({...application(),plateNumber:''}).success,false);
  assert.equal(riderApplicationInput.safeParse({...application(),vehicleType:'BICYCLE',plateNumber:''}).success,true);
  assert.equal(riderApplicationInput.safeParse({...application(),vehicleType:'BICYCLE',plateNumber:'AB'}).success,false);
});

test('identity, guarantor and terms fields must each be complete',()=>{
  const invalid=[{nin:'1234'},{ninDocumentVersion:'1794000000'},{dateOfBirth:'15/04/1999'},{guarantorNin:''},{guarantorAddress:'short'},{termsAccepted:false},{residentialAddress:'short'}];
  for(const field of invalid)assert.equal(riderApplicationInput.safeParse({...application(),...field}).success,false,JSON.stringify(field));
});
