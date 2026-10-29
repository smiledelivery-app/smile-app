import type { Product, ProductAddon } from '@makanza/mobile-core';
export type CartAddon={addon:ProductAddon;quantity:number};
export type CartLine={product:Product;quantity:number;vendorId:string;vendorName:string;addons:CartAddon[]};
