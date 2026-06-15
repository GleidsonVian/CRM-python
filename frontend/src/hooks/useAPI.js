import { useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { API_URL } from '../config.js';

/**
 * useAPI — fetch wrapper com autenticação automática.
 *
 * Retorna `apiFetch(path, options)`, onde:
 *   - path   : rota relativa, ex. '/cards' ou '/cards/1'
 *   - options: mesmo objeto do fetch nativo, com duas diferenças:
 *       • body pode ser objeto — será serializado automaticamente para JSON
 *       • headers de Authorization e Content-Type são injetados automaticamente
 *
 * Em caso de resposta 401, chama logout() e lança erro.
 * Em caso de outro erro HTTP, lança Error com o campo `detail` da resposta.
 *
 * Exemplo:
 *   const { apiFetch } = useAPI()
 *   const cards = await apiFetch('/cards')
 *   const card  = await apiFetch('/cards', { method: 'POST', body: { title: 'X' } })
 *   await apiFetch(`/cards/${id}`, { method: 'DELETE' })
 */
export function useAPI() {
  const { token, logout } = useAuth();

  const apiFetch = useCallback(async (path, options = {}) => {
    const { body, headers: extraHeaders, ...rest } = options;

    const isJson = body !== undefined && body !== null && typeof body === 'object';

    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isJson ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    };

    const res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers,
      body: isJson ? JSON.stringify(body) : body,
    });

    if (res.status === 401) {
      logout();
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (!res.ok) {
      let detail = `Erro ${res.status}`;
      try {
        const data = await res.json();
        detail = data.detail || data.message || detail;
      } catch {}
      throw new Error(detail);
    }

    // 204 No Content — sem body
    if (res.status === 204) return null;

    return res.json();
  }, [token, logout]);

  return { apiFetch };
}
