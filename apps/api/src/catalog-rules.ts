export type CatalogSource = 'database'|'development-demo';

/** Demo records may fill an empty development catalog, but never mix with real records. */
export function catalogSource(realRecordCount:number,demoMode:boolean):CatalogSource {
  return realRecordCount>0||!demoMode?'database':'development-demo';
}
