import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Pure, read-only preview. Deliberately has no database write or import action.
// Input requires an authorized export, explicit mappings, and a current snapshot.
export function previewImport(input) {
  const { source, rows, serviceMap, professionalMap, catalog, existing=[] }=input;
  if(typeof source!=='string'||!Array.isArray(rows)||!serviceMap||!professionalMap||!catalog)throw new Error('Informe source, rows, serviceMap, professionalMap e catalog.');
  const seen=new Set(), intervals=existing.filter((row)=>['confirmed','pending'].includes(row.status)), reports=[];
  for(const row of rows){
    const issues=[], professionalId=professionalMap[row.professional], serviceIds=(row.services||[]).map((id)=>serviceMap[id]);
    const key=`migration:${source}:${row.externalId}`;
    if(!row.externalId||seen.has(key)||existing.some((item)=>item.originKey===key))issues.push('Referência de origem ausente ou duplicada');
    seen.add(key);
    const pro=catalog.professionals.find((item)=>item.id===professionalId);
    if(!pro)issues.push('Profissional não mapeado');
    const services=serviceIds.map((id)=>catalog.services.find((item)=>item.id===id));
    if(!services.length||services.some((item)=>!item)||new Set(serviceIds).size!==serviceIds.length)issues.push('Serviços não mapeados ou duplicados');
    if(pro&&serviceIds.some((id)=>!pro.serviceIds.includes(id)))issues.push('Profissional incompatível');
    const startAt=typeof row.startAt==='string'&&/T.*(Z|[+-]\d{2}:\d{2})$/.test(row.startAt)&&Number.isFinite(Date.parse(row.startAt))?new Date(row.startAt).toISOString():null;
    if(!startAt)issues.push('Início exige ISO 8601 com fuso explícito');
    const duration=services.filter(Boolean).reduce((sum,service)=>sum+(pro?.pricing?.find((item)=>item.serviceId===service.id)?.durationMinutes??service.durationMinutes),0);
    const endAt=startAt&&duration>0?new Date(Date.parse(startAt)+duration*60000).toISOString():null;
    if(!endAt)issues.push('Duração inválida');
    if(startAt&&endAt&&intervals.some((item)=>item.professionalId===professionalId&&item.startAt<endAt&&item.endAt>startAt))issues.push('Conflito com reserva existente ou outra linha');
    if(!issues.length)intervals.push({professionalId,startAt,endAt});
    reports.push({externalId:row.externalId,originKey:key,professionalId,serviceIds,startAt,endAt,status:issues.length?'revisar':'validar_disponibilidade',issues});
  }
  return {readOnly:true,source,total:rows.length,rows:reports,note:'Nenhuma reserva foi importada. Linhas sem conflito ainda exigem revisão de escala, pausa, bloqueio, política, dados do cliente e autorização de corte. Revalidar no servidor no momento da futura importação.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.argv[2])throw new Error('Uso: node scripts/preview-import.mjs exportacao-autorizada.json');
  console.log(JSON.stringify(previewImport(JSON.parse(await readFile(process.argv[2],'utf8'))),null,2));
}
