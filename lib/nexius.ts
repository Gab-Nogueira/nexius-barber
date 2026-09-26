import { env } from 'cloudflare:workers';

export const BUSINESS_TIMEZONE = 'America/Sao_Paulo';
export const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed'] as const;

export type CatalogService = {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMinutes: number;
  source: 'observed' | 'demo' | 'validated';
  requiresServiceId: string | null;
  photoId: string | null;
  comboServiceIdsJson: string;
};

export type CatalogProfessional = {
  id: string;
  name: string;
  photoId?: string | null;
  photoAlt?: string | null;
  serviceIds: string[];
  pricing?: Array<{
    serviceId: string;
    priceCents: number | null;
    durationMinutes: number | null;
  }>;
};

export type BookingRecord = {
  id: string;
  reference: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  professionalId: string;
  professionalName: string;
  startAt: string;
  endAt: string;
  status: string;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  cancellationLimitHours: number;
  timezone: string;
  policyVersion: string;
  services: Array<{
    id: string;
    name: string;
    priceCents: number;
    durationMinutes: number;
  }>;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export function database(): D1Database {
  if (!env.DB)
    throw new ApiError(
      503,
      'O banco da demonstração está indisponível.',
      'database_unavailable',
    );
  return env.DB;
}

export function filesBucket(): R2Bucket {
  if (!env.FILES)
    throw new ApiError(
      503,
      'O armazenamento de arquivos está indisponível.',
      'storage_unavailable',
    );
  return env.FILES;
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: error.message,
        code: error.code,
        ...('conflicts' in error ? { conflicts: error.conflicts } : {}),
      },
      { status: error.status },
    );
  }
  console.error(error);
  return Response.json(
    {
      error: 'Não foi possível concluir a operação. Tente novamente.',
      code: 'internal_error',
    },
    { status: 500 },
  );
}

export function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function formatBusinessDateTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BUSINESS_TIMEZONE,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function zonedDateTimeToUtcIso(
  date: string,
  minuteOfDay: number,
  timeZone = BUSINESS_TIMEZONE,
) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match || minuteOfDay < 0 || minuteOfDay >= 1440) {
    throw new ApiError(400, 'Data ou horário inválido.', 'invalid_datetime');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  if (
    new Date(targetAsUtc).toISOString().slice(0, 10) !== date ||
    !Number.isInteger(minuteOfDay)
  )
    throw new ApiError(400, 'Data inexistente.', 'invalid_datetime');
  let candidate = targetAsUtc;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(candidate))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    ) as Record<string, number>;
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    candidate -= representedAsUtc - targetAsUtc;
  }
  const actual = localDateParts(new Date(candidate).toISOString(), timeZone);
  if (
    actual.date !== date ||
    actual.time !==
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  )
    throw new ApiError(
      400,
      'Este horário não existe no fuso da unidade.',
      'invalid_datetime',
    );
  return new Date(candidate).toISOString();
}

export function localDateParts(iso: string, timeZone = BUSINESS_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(iso))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function demoModeEnabled() {
  return process.env.DEMO_MODE === 'true';
}
