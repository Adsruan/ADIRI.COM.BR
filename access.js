/* Only an opaque HttpOnly cookie persists. Firebase credentials stay in memory. */
(() => {
'use strict';
window.LouvorAccess={mount};
async function mount({onAuthenticated,onLocked}) {
  const $=id=>document.getElementById(id), auth=firebase.auth();
  const form=$('access-form'), password=$('access-password'), submit=$('access-submit'), error=$('access-error');
  let active=false,busy=false,loggingOut=false,logoutPending=false,deadline=0,heartbeat=null,expiryTimer=null;
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('louvor-access'):null;
  const show=message=>{document.body.classList.add('access-locked');$('access-screen').hidden=false;error.textContent=message||'';};
  function lock(message){active=false;clearInterval(heartbeat);clearInterval(expiryTimer);onLocked();document.querySelectorAll('dialog[open]').forEach(d=>d.close());show(message);}
  async function request(body) {
    const response=await fetch('/api/access',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json','X-Louvor-Request':'1'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
    let result;try{result=await response.json()}catch{throw new Error('Não foi possível validar o acesso. Tente novamente.');}
    if(!response.ok){const e=new Error(result.error||'Não foi possível validar o acesso.');e.status=response.status;throw e;}return result;
  }
  async function accept(result){
    await auth.signInWithCustomToken(result.firebaseToken);
    deadline=performance.now()+Math.max(0,result.expires-result.serverNow);
    if(deadline<=performance.now())throw new Error('Sua sessão expirou. Entre novamente.');
    if(!active){active=true;document.body.classList.remove('access-locked');$('access-screen').hidden=true;password.value='';error.textContent='';onAuthenticated();}
    clearInterval(heartbeat);clearInterval(expiryTimer);heartbeat=setInterval(check,15*60*1000);expiryTimer=setInterval(()=>{if(performance.now()>=deadline)expire();},1000);
  }
  async function expire(message='Sua sessão expirou. Entre novamente.') {
    lock(message);await auth.signOut().catch(()=>{});
    // Reload scrubs the Firestore memory cache and the reader's private state.
    location.reload();
  }
  async function check(){if(busy||loggingOut)return;busy=true;try{await accept(await request());}catch(e){if(e.status===401){if(active)await expire();else show('');}else if(!active)show(e.message);}finally{busy=false;}}
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(logoutPending){logout();return}if(busy||loggingOut)return;busy=true;submit.disabled=true;error.textContent='';
    try{await accept(await request({action:'login',password:password.value}));}catch(e){show(e.message);}finally{busy=false;submit.disabled=false;}
  });
  $('access-toggle').addEventListener('click',()=>{const visible=password.type==='password';password.type=visible?'text':'password';$('access-toggle').textContent=visible?'Ocultar':'Mostrar';$('access-toggle').setAttribute('aria-pressed',String(visible));});
  $('access-logout').addEventListener('click',logout);
  async function logout(){if(loggingOut)return;loggingOut=true;logoutPending=true;lock('Encerrando o acesso…');submit.disabled=true;
    try{await request({action:'logout'});channel?.postMessage('logout');await auth.signOut();location.reload();}
    catch{show('Não foi possível encerrar a sessão no servidor. Toque em “Tentar sair novamente”.');submit.textContent='Tentar sair novamente';submit.disabled=false;}
    finally{loggingOut=false;}
  }
  channel?.addEventListener('message',event=>{if(event.data==='logout')expire('Acesso encerrado.');});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&active){if(performance.now()>=deadline)expire();else check();}});
  auth.onIdTokenChanged(user=>{if(active&&!user&&!loggingOut)expire();});
  window.addEventListener('louvor-access-denied',()=>{if(active)expire();});
  try{await auth.setPersistence(firebase.auth.Auth.Persistence.NONE);await check();}catch{show('Não foi possível iniciar o acesso seguro. Atualize a página.');}
}
})();
