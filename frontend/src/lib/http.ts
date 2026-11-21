export async function consultar<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Não foi possível carregar os dados. Tente novamente.');
  return response.json() as Promise<T>;
}
