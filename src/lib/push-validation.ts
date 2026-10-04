const PUSH_HOSTS=["fcm.googleapis.com","updates.push.services.mozilla.com","push.services.mozilla.com","web.push.apple.com","wns.windows.com","notify.windows.com"];
export function validPushSubscription(value:unknown):value is {endpoint:string;keys:{p256dh:string;auth:string}} {
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const item=value as Record<string,unknown>;if(typeof item.endpoint!=="string"||item.endpoint.length>2000)return false;
 let url:URL;try{url=new URL(item.endpoint);}catch{return false;}
 if(url.protocol!=="https:"||url.username||url.password||(url.port&&url.port!=="443")||!PUSH_HOSTS.some(host=>url.hostname===host||url.hostname.endsWith("."+host)))return false;
 const keys=item.keys as Record<string,unknown>|undefined;
 return Boolean(keys&&typeof keys.p256dh==="string"&&/^[A-Za-z0-9_-]{80,100}$/.test(keys.p256dh)&&typeof keys.auth==="string"&&/^[A-Za-z0-9_-]{20,30}$/.test(keys.auth));
}
