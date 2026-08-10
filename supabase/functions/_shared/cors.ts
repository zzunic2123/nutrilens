const configuredOrigins = (Deno.env.get('APP_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173']

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin') ?? ''
  const allowed = configuredOrigins.includes(origin) ||
    localOrigins.includes(origin)
  return {
    'Access-Control-Allow-Origin': allowed ? origin : configuredOrigins[0] ?? localOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
