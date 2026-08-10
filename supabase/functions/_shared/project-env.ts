function namedKey(variable: string): string | undefined {
  const raw = Deno.env.get(variable)
  if (!raw) return undefined
  try {
    const keys = JSON.parse(raw) as Record<string, unknown>
    const preferred = keys.default
    if (typeof preferred === 'string' && preferred) return preferred
    return Object.values(keys).find((value): value is string =>
      typeof value === 'string' && value.length > 0
    )
  } catch {
    return undefined
  }
}

/** Supports both current publishable/secret keys and legacy anon/service-role keys. */
export function projectCredentials() {
  return {
    url: Deno.env.get('SUPABASE_URL'),
    publishableKey: namedKey('SUPABASE_PUBLISHABLE_KEYS') ??
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
      Deno.env.get('SUPABASE_ANON_KEY'),
    secretKey: namedKey('SUPABASE_SECRET_KEYS') ??
      Deno.env.get('SUPABASE_SECRET_KEY') ??
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}
