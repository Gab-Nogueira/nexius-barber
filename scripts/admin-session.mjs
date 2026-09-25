import { createInterface } from 'node:readline/promises';
import { stdin,stdout } from 'node:process';
export async function adminSession(base='http://localhost:3000') {
  if(!stdin.isTTY)throw new Error('Execute este script em um terminal interativo para informar seu acesso administrativo.');
  const rl=createInterface({input:stdin,output:stdout});const username=(await rl.question('Usuario da gestao: ')).trim();rl.close();
  stdout.write('Senha (digitacao oculta): ');stdin.setRawMode(true);stdin.resume();
  const password=await new Promise((resolve,reject)=>{let value='';const done=()=>{stdin.off('data',read);stdin.setRawMode(false);stdin.pause();stdout.write('\n');};function read(buffer){for(const ch of buffer.toString('utf8')){if(ch==='\u0003'){done();reject(new Error('Cancelado.'));return;}if(ch==='\r'||ch==='\n'){done();resolve(value);return;}if(ch==='\u007f'||ch==='\b')value=value.slice(0,-1);else if(ch>=' '&&value.length<257)value+=ch;}}stdin.on('data',read);});
  const response=await fetch(`${base}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  if(!response.ok)throw new Error('Login recusado. Confira os dados e aguarde se houve varias tentativas.');
  return response.headers.get('set-cookie').split(';')[0];
}
