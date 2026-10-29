export type Coordinate = { latitude: number; longitude: number };

export function distanceInKm(from: Coordinate, to: Coordinate): number | null {
  if (![from.latitude, from.longitude, to.latitude, to.longitude].every(Number.isFinite)) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
