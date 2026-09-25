import { randomBytes } from 'node:crypto';
import { provisionLocalStaff, localSql } from '../scripts/staff-account.mjs';
export async function testAdmin(base) {
  if(!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname))throw new Error('Fixtures de senha permitidas somente no ambiente local.');
  const username=`test_${randomBytes(6).toString('hex')}`, password=randomBytes(24).toString('base64url');
  const userId=await provisionLocalStaff(username,password);
  const dispose=async()=>{await localSql(`DELETE FROM sessions WHERE user_id='${userId}'; DELETE FROM credentials WHERE user_id='${userId}'; UPDATE users SET role='customer' WHERE id='${userId}';`);};
  const response=await fetch(`${base}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  if(!response.ok){await dispose();throw new Error(`Login de teste: ${response.status} ${await response.text()}`);}
  return {cookie:response.headers.get('set-cookie').split(';')[0],username,password,userId,dispose};
}
