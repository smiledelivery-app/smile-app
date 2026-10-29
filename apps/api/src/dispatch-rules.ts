export type RiderCandidate={id:string;latitude:number;longitude:number;serviceArea:string};
export type NearbyRider=RiderCandidate&{pickupDistanceKm:number};

export function rankRidersByRoadDistance<T extends {id:string}>(riders:T[],roadDistancesKm:ReadonlyMap<string,number>,maxDistanceKm:number,limit=3):(T&{pickupDistanceKm:number})[] {
  if(!Number.isFinite(maxDistanceKm)||maxDistanceKm<0||!Number.isInteger(limit)||limit<0) return [];
  return riders.flatMap(rider=>{
    const pickupDistanceKm=roadDistancesKm.get(rider.id);
    return pickupDistanceKm!==undefined&&Number.isFinite(pickupDistanceKm)&&pickupDistanceKm>=0&&pickupDistanceKm<=maxDistanceKm?[{...rider,pickupDistanceKm}]:[];
  }).sort((a,b)=>a.pickupDistanceKm-b.pickupDistanceKm).slice(0,limit);
}

export function distanceKm(lat1:number,lon1:number,lat2:number,lon2:number) {
  const rad=(degrees:number)=>degrees*Math.PI/180;
  const dLat=rad(lat2-lat1),dLon=rad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

export function nearestEligibleRiders<T extends RiderCandidate>(riders:T[],pickup:{latitude:number;longitude:number},area:string,alreadyOffered:Set<string>,maxDistanceKm:number,limit=3):(T&{pickupDistanceKm:number})[] {
  const expectedArea=area.trim().toLowerCase();
  if(!Number.isFinite(maxDistanceKm)||maxDistanceKm<0||!Number.isInteger(limit)||limit<0) return [];
  return riders.flatMap(rider=>{
    if(alreadyOffered.has(rider.id))return [];
    const riderArea=rider.serviceArea.trim().toLowerCase();
    if(expectedArea&&(!riderArea||(!expectedArea.includes(riderArea)&&!riderArea.includes(expectedArea))))return [];
    const pickupDistanceKm=distanceKm(rider.latitude,rider.longitude,pickup.latitude,pickup.longitude);
    return Number.isFinite(pickupDistanceKm)&&pickupDistanceKm<=maxDistanceKm?[{...rider,pickupDistanceKm}]:[];
  }).sort((a,b)=>a.pickupDistanceKm-b.pickupDistanceKm).slice(0,limit);
}
