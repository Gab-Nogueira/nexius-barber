import { ApiError, database } from './nexius';

export async function revision(kind: 'config' | 'operation' = 'operation') {
  const result = await database().prepare(`SELECT ${kind}_revision AS revision FROM business_settings WHERE id = 'main'`).first<{ revision: number }>();
  if (!result) throw new ApiError(503, 'Configure a unidade antes de continuar.', 'settings_missing');
  return result.revision;
}

// The first statement aborts the WHOLE D1 batch if the checked snapshot is stale.
// Database triggers advance revisions, including writes made outside the UI.
export async function guardedBatch(expected: number, statements: D1PreparedStatement[], kind: 'config' | 'operation' = 'operation') {
  const db = database();
  const id = crypto.randomUUID();
  try {
    const results = await db.batch([
      db.prepare(`INSERT INTO mutation_checks (id, ok) VALUES (?, COALESCE((SELECT ${kind}_revision = ? FROM business_settings WHERE id = 'main'), 0))`).bind(id, expected),
      ...statements,
      db.prepare('DELETE FROM mutation_checks WHERE id = ?').bind(id),
    ]);
    return results.slice(1, -1);
  } catch (error) {
    if (String(error).includes('mutation_revision_current')) throw new ApiError(409, 'A agenda ou configuração mudou durante a operação. Atualize e revise antes de tentar novamente.', 'configuration_changed');
    throw error;
  }
}

export function audit(actor: string, action: string, type: string, id: string, detail: object) {
  return database().prepare(`INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), actor, action, type, id, JSON.stringify(detail), new Date().toISOString());
}

export function requireChanged() {
  const id = crypto.randomUUID();
  return [database().prepare('INSERT INTO mutation_checks (id, ok) VALUES (?, CASE WHEN changes() > 0 THEN 1 ELSE 0 END)').bind(id), database().prepare('DELETE FROM mutation_checks WHERE id = ?').bind(id)];
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ApiError(403, 'Origem da solicitação não autorizada.', 'cross_origin_request');
  }
}
