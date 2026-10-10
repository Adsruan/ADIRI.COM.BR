// Limpeza diária no plano Hobby. As regras do Firestore impedem apagar cultos
// com menos de 72h, mesmo que esta rota seja chamada antecipadamente.
const PROJECT='louvor-central';
const KEY='AIzaSyBz7gYvEC0Ucg5CHBDNo1oWkTiyZWz16F4'; // Configuração web pública.
const ROOT=`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Método não permitido'});
 if(process.env.CRON_SECRET&&req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'Não autorizado'});
 try{
  const cutoff=new Date(Date.now()-72*60*60*1000).toISOString();
  const result=await fetch(`${ROOT}:runQuery?key=${KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:'services'}],where:{fieldFilter:{field:{fieldPath:'created_at'},op:'LESS_THAN_OR_EQUAL',value:{timestampValue:cutoff}}},limit:100}}),signal:AbortSignal.timeout(10000)});
  if(!result.ok)throw new Error(`Consulta recusada: ${result.status}`);
  const rows=await result.json();let removed=0;
  const documents=rows.filter(r=>r.document).map(r=>r.document);
  for(let i=0;i<documents.length;i+=10){await Promise.all(documents.slice(i,i+10).map(async doc=>{
   if(!doc.name.startsWith(`projects/${PROJECT}/databases/(default)/documents/services/`))throw new Error('Documento fora do escopo');
   if(Date.parse(doc.fields.created_at.timestampValue)>Date.parse(cutoff))throw new Error('Prazo ainda não atingido');
   const response=await fetch(`https://firestore.googleapis.com/v1/${doc.name}?key=${KEY}&currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`,{method:'DELETE',signal:AbortSignal.timeout(10000)});
   if(response.ok)removed++;else if(response.status!==404&&response.status!==409)throw new Error(`Exclusão recusada: ${response.status}`);
  }))}
  return res.status(200).json({ok:true,removed,cutoff,checked:documents.length,moreMayRemain:documents.length===100});
 }catch(error){return res.status(500).json({ok:false,error:error.message})}
};
