import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { provisionLocalStaff } from './staff-account.mjs';

if(!stdin.isTTY)throw new Error('Abra CONFIGURAR-ACESSO.cmd em um terminal interativo. Nunca passe a senha na linha de comando.');
const rl=createInterface({input:stdin,output:stdout});
const username=(await rl.question('Usuario da gestao (novo ou existente para redefinir): ')).trim().toLowerCase();
rl.close();
async function password(prompt){
  stdout.write(prompt);stdin.setRawMode(true);stdin.resume();let value='';
  return new Promise((resolve,reject)=>{
    function done(){stdin.off('data',onData);stdin.setRawMode(false);stdin.pause();stdout.write('\n');}
    function onData(buffer){for(const ch of buffer.toString('utf8')){if(ch==='\u0003'){done();reject(new Error('Cancelado.'));return;}if(ch==='\r'||ch==='\n'){done();resolve(value);return;}if(ch==='\u007f'||ch==='\b'){value=value.slice(0,-1);}else if(ch>=' '&&value.length<257)value+=ch;}}
    stdin.on('data',onData);
  });
}
try {
  const first=await password('Senha (minimo 12 caracteres; digitacao oculta): ');
  const second=await password('Repita a senha: ');
  if(first!==second)throw new Error('As senhas nao coincidem. Nenhuma alteracao feita.');
  await provisionLocalStaff(username,first);
  console.log('Acesso local configurado. Abra http://localhost:3000/gestao e entre com o usuario escolhido. Sessoes anteriores desta conta foram encerradas.');
}catch(error){console.error(error.message);process.exitCode=1;}
