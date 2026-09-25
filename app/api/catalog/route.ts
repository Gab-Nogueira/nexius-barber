import { getCatalog } from '@/lib/booking-engine';
import { jsonError } from '@/lib/nexius';

export async function GET() {
  try {
    return Response.json(await getCatalog(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
