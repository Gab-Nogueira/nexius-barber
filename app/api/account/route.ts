import { requireApiUser } from '@/lib/authz';
import { ensureUser } from '@/lib/booking-engine';
import { ApiError, jsonError } from '@/lib/nexius';
import { assertSameOrigin } from '@/lib/transactions';
export async function GET() {
  try { const user=await requireApiUser(); return Response.json({account:await ensureUser(user)},{headers:{'Cache-Control':'no-store'}}); } catch(error){return jsonError(error);}
}
export async function PATCH(request:Request) {
  try {
    assertSameOrigin(request);const user=await requireApiUser();const body=await request.json() as {name?:unknown;phone?:unknown};
    if(typeof body.name!=='string'||body.name.trim().length<2||body.name.length>100||typeof body.phone!=='string'||!/^\d{10,13}$/.test(body.phone.replace(/\D/g,'')))throw new ApiError(400,'Revise nome e telefone.','invalid_contact');
    return Response.json({account:await ensureUser(user,body.name,body.phone)},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return jsonError(error);}
}
