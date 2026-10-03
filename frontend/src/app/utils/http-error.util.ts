/**
 * Extrae un mensaje legible de un error HTTP. Evita mostrar "[object Object]"
 * cuando el backend responde con un JSON sin `message`.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  const body = (err as { error?: unknown } | null)?.error;
  if (typeof body === 'string' && body.trim()) {
    return body;
  }
  if (body && typeof body === 'object') {
    const { message, error } = body as { message?: unknown; error?: unknown };
    if (typeof message === 'string' && message.trim()) return message;
    if (typeof error === 'string' && error.trim()) return error;
  }
  return fallback;
}
