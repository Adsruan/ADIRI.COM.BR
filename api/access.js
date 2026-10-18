'use strict';
const crypto = require('node:crypto');
const {promisify} = require('node:util');
const scrypt = promisify(crypto.scrypt);
const DAYS30 = 30 * 24 * 60 * 60 * 1000;
const COOKIE = '__Host-lc_access';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, {N:32768,r:8,p:1,maxmem:64*1024*1024});
  return `scrypt:${salt}:${key.toString('hex')}`;
}
async function verifyPassword(password, encoded) {
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(encoded || '')) throw new Error('Invalid password configuration');
  const [,salt,hex] = encoded.split(':');
  const key = await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return crypto.timingSafeEqual(key,Buffer.from(hex,'hex'));
}
function cookie(token, age = DAYS30 / 1000) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}
function cookieToken(req) {
  const match = (req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE}=`));
  const token = match?.slice(COOKIE.length+1);
  return /^[A-Za-z0-9_-]{43}$/.test(token || '') ? token : null;
}
function createHandler(runtime, options = {}) {
  const now = options.now || Date.now;
  return async function access(req,res) {
    res.setHeader('Cache-Control','no-store, private');
    res.setHeader('Pragma','no-cache');
    const reply = (status,body) => res.status(status).json(body);
    if (!['GET','POST'].includes(req.method)) {res.setHeader('Allow','GET, POST');return reply(405,{error:'Método não permitido.'});}
    try {
      const token = cookieToken(req);
      if (req.method === 'GET' && !token) return reply(401,{error:'Informe a senha para entrar.'});
      const rt = await runtime();
      if (req.method === 'POST') {
        if (req.headers.origin !== rt.origin || req.headers['x-louvor-request'] !== '1' || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return reply(403,{error:'Solicitação não autorizada.'});
        let body=req.body;
        if (typeof body === 'string') {if(Buffer.byteLength(body)>1024)return reply(413,{error:'Solicitação muito grande.'});try{body=JSON.parse(body)}catch{return reply(400,{error:'Solicitação inválida.'})}}
        if (!body || typeof body !== 'object') return reply(400,{error:'Solicitação inválida.'});
        if (body.action === 'logout') {
          if(token)await rt.revoke(digest(token));
          res.setHeader('Set-Cookie',cookie('',0));return reply(200,{ok:true});
        }
        if (body.action !== 'login' || typeof body.password !== 'string' || body.password.length>128 || !body.password.length) return reply(400,{error:'Informe a senha.'});
        const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
        const bucket = crypto.createHmac('sha256',rt.hash).update(String(ip)).digest('hex');
        const wait=await rt.reserve(bucket,now());
        if(wait){res.setHeader('Retry-After',String(wait));return reply(429,{error:'Muitas tentativas. Aguarde alguns minutos e tente novamente.'});}
        if (!await verifyPassword(body.password,rt.hash)) return reply(401,{error:'Senha incorreta. Tente novamente.'});
        await rt.release?.(bucket);
        const raw=crypto.randomBytes(32).toString('base64url');
        const sid=digest(raw), uid=`lc_${crypto.randomBytes(16).toString('hex')}`, expires=now()+DAYS30;
        await rt.create(sid,{uid,expires});
        // Generate the Firebase token before issuing the cookie: a signing failure must fail closed.
        const firebaseToken=await rt.sign(uid,{louvor_access:true,access_session:sid,access_expires:expires});
        res.setHeader('Set-Cookie',cookie(raw));
        return reply(200,{firebaseToken,expires,serverNow:now()});
      }
      const sid=digest(token), session=await rt.read(sid);
      if (!session || session.revoked || session.expires<=now()) {res.setHeader('Set-Cookie',cookie('',0));return reply(401,{error:'Sua sessão expirou. Entre novamente.'});}
      const firebaseToken=await rt.sign(session.uid,{louvor_access:true,access_session:sid,access_expires:session.expires});
      return reply(200,{firebaseToken,expires:session.expires,serverNow:now()});
    } catch {
      // Never log request bodies, cookies, credentials or tokens.
      return reply(503,{error:'Não foi possível validar o acesso. Tente novamente em instantes.'});
    }
  };
}
let runtimePromise;
async function runtime() {
  if (!runtimePromise) runtimePromise = (async()=>{
    const {initializeApp,cert,getApps}=require('firebase-admin/app');
    const {getAuth}=require('firebase-admin/auth');
    const {getFirestore,Timestamp}=require('firebase-admin/firestore');
    const hash=process.env.ACCESS_PASSWORD_HASH, origin=process.env.ACCESS_ORIGIN;
    if (!hash || !origin || new URL(origin).origin!==origin) throw new Error('Access configuration missing');
    const credentials=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    const app=getApps()[0] || initializeApp({credential:cert(credentials)});
    const db=getFirestore(app), sessions=db.collection('_access_sessions');
    return {
      hash,origin,
      sign:(uid,claims)=>getAuth(app).createCustomToken(uid,claims),
      create:(id,s)=>sessions.doc(id).create({uid:s.uid,expires_at:Timestamp.fromMillis(s.expires),revoked:false,created_at:Timestamp.now()}),
      read:async id=>{const doc=await sessions.doc(id).get();if(!doc.exists)return null;const d=doc.data();return {uid:d.uid,expires:d.expires_at.toMillis(),revoked:d.revoked};},
      revoke:async id=>{const ref=sessions.doc(id);await db.runTransaction(async tx=>{const doc=await tx.get(ref);if(doc.exists)tx.update(ref,{revoked:true});});},
      release:async bucket=>db.runTransaction(async tx=>{const ref=db.collection('_access_attempts').doc(bucket);const d=await tx.get(ref);if(d.exists)tx.update(ref,{count:Math.max(0,d.data().count-1)});}),
      reserve:async (bucket,now)=>db.runTransaction(async tx=>{
        const refs=[db.collection('_access_attempts').doc(bucket),db.collection('_access_attempts').doc('global')];
        const docs=await Promise.all(refs.map(ref=>tx.get(ref)));
        const limits=[8,500], windowMs=15*60*1000;
        const states=docs.map(d=>d.exists&&d.data().reset_at.toMillis()>now?{count:d.data().count,reset:d.data().reset_at.toMillis()}:{count:0,reset:now+windowMs});
        for(let i=0;i<2;i++)if(states[i].count>=limits[i])return Math.max(1,Math.ceil((states[i].reset-now)/1000));
        states.forEach((s,i)=>tx.set(refs[i],{count:s.count+1,reset_at:Timestamp.fromMillis(s.reset)}));return 0;
      })
    };
  })().catch(e=>{runtimePromise=null;throw e;});
  return runtimePromise;
}
module.exports=createHandler(runtime);
module.exports.createHandler=createHandler;
module.exports.hashPassword=hashPassword;
module.exports.verifyPassword=verifyPassword;
module.exports.DAYS30=DAYS30;
