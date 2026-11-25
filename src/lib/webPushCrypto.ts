import {createCipheriv,createECDH,createPrivateKey,hkdfSync,randomBytes,sign} from 'node:crypto';
export type PushKeys={p256dh:string;auth:string};
export function validPushEndpoint(value:string){
 try{const u=new URL(value);const host=u.hostname.toLowerCase();return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&value.length<=4096&&(
 host==='fcm.googleapis.com'||host==='android.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host==='web.push.apple.com'||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com'));}catch{return false;}
}
export function validPushKeys(keys:PushKeys){
 try{const pub=Buffer.from(keys.p256dh,'base64url'),auth=Buffer.from(keys.auth,'base64url');if(pub.length!==65||pub[0]!==4||auth.length!==16)return false;const ec=createECDH('prime256v1');ec.generateKeys();ec.computeSecret(pub);return true;}catch{return false;}
}
const hkdf=(secret:Buffer,salt:Buffer,info:Buffer,length:number)=>Buffer.from(hkdfSync('sha256',secret,salt,info,length));
/** RFC 8291 single-record encryption with RFC 8188 aes128gcm framing. */
export function encryptPush(payload:Buffer,keys:PushKeys){
 if(payload.length>3000||!validPushKeys(keys))throw Error('Invalid Web Push payload or keys');
 const receiver=Buffer.from(keys.p256dh,'base64url'),auth=Buffer.from(keys.auth,'base64url'),ec=createECDH('prime256v1');ec.generateKeys();
 const sender=ec.getPublicKey(),shared=ec.computeSecret(receiver),salt=randomBytes(16);
 const ikm=hkdf(shared,auth,Buffer.concat([Buffer.from('WebPush: info\0'),receiver,sender]),32);
 const cek=hkdf(ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16),nonce=hkdf(ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12);
 const cipher=createCipheriv('aes-128-gcm',cek,nonce),encrypted=Buffer.concat([cipher.update(Buffer.concat([payload,Buffer.from([2])])),cipher.final(),cipher.getAuthTag()]);
 const header=Buffer.alloc(5);header.writeUInt32BE(4096);header[4]=sender.length;
 return Buffer.concat([salt,header,sender,encrypted]);
}
export function vapidAuthorization(endpoint:string,privateKey:string,subject:string,now=Date.now()){
 const ec=createECDH('prime256v1');const scalar=Buffer.from(privateKey,'base64url');if(scalar.length!==32)throw Error('Invalid VAPID key');ec.setPrivateKey(scalar);const pub=ec.getPublicKey();
 const key=createPrivateKey({format:'jwk',key:{kty:'EC',crv:'P-256',x:pub.subarray(1,33).toString('base64url'),y:pub.subarray(33,65).toString('base64url'),d:scalar.toString('base64url')}});
 const header=Buffer.from(JSON.stringify({typ:'JWT',alg:'ES256'})).toString('base64url');
 const claims=Buffer.from(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(now/1000)+3600,sub:subject})).toString('base64url');
 const data=header+'.'+claims,sig=sign('sha256',Buffer.from(data),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
 return {publicKey:pub.toString('base64url'),authorization:'vapid t='+data+'.'+sig+', k='+pub.toString('base64url')};
}
