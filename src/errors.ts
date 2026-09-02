type ApiError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
  status?: number;
  error_description?: string;
};

// PGRST301/302: o PostgREST recebeu um JWT vencido ou inválido.
// 42501: o Postgres tratou a requisição como anônima e negou a permissão.
const SESSION_CODES = ['PGRST301', 'PGRST302', '42501'];

export function isSessionError(e: unknown): boolean {
  const err = (e || {}) as ApiError;
  if (err.status === 401 || err.status === 403) return true;
  if (err.code && SESSION_CODES.includes(err.code)) return true;
  const text = `${err.message || ''} ${err.details || ''}`.toLowerCase();
  return /jwt|refresh token|not authenticated|row-level security/.test(text);
}

export function errorDetail(e: unknown): string {
  const err = (e || {}) as ApiError;
  const parts = [err.message || err.error_description, err.details, err.hint].filter(Boolean);
  const base = parts.length ? parts.join(' — ') : String(e);
  return err.code ? `${base} (${err.code})` : base;
}
