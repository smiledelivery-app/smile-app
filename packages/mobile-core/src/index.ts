export class ApiError extends Error {
  constructor(message:string,public readonly status:number,public readonly code?:string) {
    super(message); this.name='ApiError';
  }
}

type RequestOptions = Omit<RequestInit,'headers'> & { token?:string; headers?:Record<string,string> };

export function createApiClient(baseUrl:string) {
  const request = async <T>(path:string,options:RequestOptions={}):Promise<T> => {
    if(!baseUrl) throw new ApiError('API URL is not configured. Set EXPO_PUBLIC_API_URL and restart the app.',0,'API_URL_MISSING');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch(`${baseUrl.replace(/\/$/,'')}${path}`,{
        ...options,
        signal:controller.signal,
        headers:{accept:'application/json','content-type':'application/json',...(options.token?{authorization:`Bearer ${options.token}`}:{ }),...options.headers}
      });
      if(response.status===204) return undefined as T;
      const body=await response.json().catch(()=>null) as {data?:T;error?:{message?:string;code?:string}}|null;
      if(!response.ok) throw new ApiError(body?.error?.message??'The service could not complete this request.',response.status,body?.error?.code);
      if(!body || !('data' in body)) throw new ApiError('The service returned an unexpected response.',response.status,'INVALID_RESPONSE');
      return body.data as T;
    } catch(error) {
      if(error instanceof ApiError) throw error;
      if(error instanceof Error && error.name==='AbortError') throw new ApiError('The request timed out. Check your connection and retry.',0,'TIMEOUT');
      throw new ApiError('Could not reach Smile. Check your connection and retry.',0,'NETWORK_ERROR');
    } finally { clearTimeout(timeout); }
  };
  return {
    get:<T>(path:string,token?:string)=>request<T>(path,{method:'GET',token}),
    post:<T>(path:string,data:unknown,token?:string)=>request<T>(path,{method:'POST',body:JSON.stringify(data),token}),
    put:<T>(path:string,data:unknown,token?:string)=>request<T>(path,{method:'PUT',body:JSON.stringify(data),token}),
    patch:<T>(path:string,data:unknown,token?:string)=>request<T>(path,{method:'PATCH',body:JSON.stringify(data),token}),
    delete:<T=void>(path:string,token?:string,data?:unknown)=>request<T>(path,{method:'DELETE',body:data===undefined?undefined:JSON.stringify(data),token})
  };
}

export type Session = { token:string; expiresAt:string; user:{id:string;name:string;email:string|null;phone?:string|null;roles:string[]} };
export type Vendor = {id:string;name:string;cuisine:string;neighborhood:string;eta:string;fee:number;rating:number|null;image:string;open:boolean;demo:boolean;latitude?:number|null;longitude?:number|null};
export type ProductAddon = {id:string;productId:string;name:string;priceMinor:number;available:boolean};
export type Product = {id:string;name:string;description:string;category:string;priceMinor:number;imageUrl:string|null;stock:number|null;addons?:ProductAddon[]};
export type OrderItemAddon = {id:string;nameSnapshot:string;unitPriceMinor:number;quantity:number};
export type OrderItem = {id:string;nameSnapshot:string;quantity:number;unitPriceMinor:number;addons?:OrderItemAddon[]};
export type OrderTracking = {deliveryId:string;deliveryStatus:string;vendor:{name:string;latitude:number|null;longitude:number|null};customer:{latitude:number|null;longitude:number|null};rider:{latitude:number;longitude:number;updatedAt:string}|null};
export type CustomerOrder = {id:string;status:string;totalMinor:number;createdAt:string;deliveryCode?:string|null;tracking?:OrderTracking|null;delivery?:{status:string;assignedAt:string|null;riderName:string|null}|null;items:OrderItem[];vendor?:{name:string};events:{id:string;status:string;createdAt:string;note?:string|null}[]};
export type VendorOrder = {id:string;status:string;totalMinor:number;createdAt:string;items:OrderItem[];events:{id:string;status:string;createdAt:string}[];delivery?:{status:string;assignedAt:string|null;riderName:string|null;pickupCode:string|null}|null};
export type RiderProfile = {id:string;status:string;available:boolean;vehicleType:string|null;serviceArea:string;location:{updatedAt:string}|null};
export type RiderOffer = {id:string;deliveryId:string;expiresAt:string;pickupDistanceKm:number|null;vendor:{name:string;address:string};dropoffCity:string;itemCount:number;totalMinor:number};
export type RiderDelivery = {id:string;status:string;order:{id:string;status:string;vendor:{id:string;name:string;address:string;latitude:number|string|null;longitude:number|string|null};address:{line1:string;city:string;latitude:number|string|null;longitude:number|string|null}|null;items:OrderItem[]}};
