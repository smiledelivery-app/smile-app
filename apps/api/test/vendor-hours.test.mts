import test from 'node:test';
import assert from 'node:assert/strict';
import { vendorOperatingHoursInput } from '../src/vendor-hours.ts';

const weeklySchedule=()=>Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,isClosed:false,openingTime:'09:00',closingTime:'21:00'}));

test('vendor hours require exactly one schedule for each weekday',()=>{
  assert.equal(vendorOperatingHoursInput.safeParse(weeklySchedule()).success,true);
  assert.equal(vendorOperatingHoursInput.safeParse(weeklySchedule().slice(1)).success,false);
  const duplicate=weeklySchedule();duplicate[6]!.dayOfWeek=5;
  assert.equal(vendorOperatingHoursInput.safeParse(duplicate).success,false);
});

test('closed days cannot have hours and open days require valid 24-hour times',()=>{
  const schedule=weeklySchedule();
  schedule[0]={dayOfWeek:0,isClosed:true,openingTime:null,closingTime:null};
  assert.equal(vendorOperatingHoursInput.safeParse(schedule).success,true);
  schedule[0]={dayOfWeek:0,isClosed:true,openingTime:'09:00',closingTime:null};
  assert.equal(vendorOperatingHoursInput.safeParse(schedule).success,false);
  schedule[0]={dayOfWeek:0,isClosed:false,openingTime:'25:00',closingTime:'21:00'};
  assert.equal(vendorOperatingHoursInput.safeParse(schedule).success,false);
});
