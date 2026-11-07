export type CatalogSource = 'database'|'development-demo';

export function canAccessDemoFeatures(email:string|null|undefined,isDemo:boolean,nodeEnvironment:string|undefined):boolean {
  return nodeEnvironment!=='production'&&isDemo&&email?.toLowerCase()==='smile@gmail.com';
}

/** Demo records are isolated to the authenticated test account outside production. */
export function catalogSource(canAccessDemo:boolean):CatalogSource {
  return canAccessDemo?'development-demo':'database';
}

export function shouldUseMockCheckout(vendorIsDemo:boolean,canAccessDemo:boolean):boolean {
  return vendorIsDemo&&canAccessDemo;
}
