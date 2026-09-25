import { requireAdmin } from '@/lib/authz';
import { getSettings, listAllBookings } from '@/lib/booking-engine';
import { agendaCsv, filterAgenda } from '@/lib/agenda-export';
import { ApiError, jsonError } from '@/lib/nexius';
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams,
      date = params.get('date') || '';
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      throw new ApiError(400, 'Selecione uma data válida.', 'invalid_date');
    const settings = await getSettings();
    const records = filterAgenda(
      await listAllBookings(),
      {
        date,
        professional: params.get('professional') || '',
        status: params.get('status') || '',
        search: (params.get('search') || '').slice(0, 100),
      },
      settings.timezone,
    );
    return new Response(agendaCsv(records, settings.timezone), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="nexius-agenda-${date}.csv"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
