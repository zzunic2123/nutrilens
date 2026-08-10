import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { mealAnalysisSchema, validateMealAnalysis } from '../_shared/meal-schema.ts'
import { projectCredentials } from '../_shared/project-env.ts'

const OPENAI_URL = 'https://api.openai.com/v1/responses'
const MAX_TEXT_LENGTH = 2_000
const MAX_IMAGE_DATA_URL_LENGTH = 2_750_000
const DEFAULT_DAILY_LIMIT = 30

const instructions =
  `You estimate the nutrition of one meal from either a user description or a food photograph.

Return a point estimate for the whole meal as eaten. Identify only foods that are visible or explicitly described. Estimate portions in grams when reasonable. Account for likely cooking oil, dressings, sauces and drinks, but clearly list every assumption. Never claim that a photo reveals hidden ingredients with certainty.

Use status "estimated" when there is enough information for a useful estimate, "needs_clarification" when an important ambiguity could materially change the result, and "not_food" when the input is not a meal. For "not_food", return null nutrition values and an empty detected_foods list. For normal estimates, calories, protein, carbs and fat must be non-null, finite and non-negative. Fiber may be null.

Use a short natural title and a factual one-sentence description. Nutrition estimates are informational, not medical advice. Do not add prose outside the required JSON schema.`

interface AnalyzeBody {
  mode?: unknown
  text?: unknown
  imageDataUrl?: unknown
}

function extractOutput(
  response: Record<string, unknown>,
): { text?: string; refusal?: string } {
  if (!Array.isArray(response.output)) return {}
  for (const output of response.output) {
    if (
      !output || typeof output !== 'object' || !('content' in output) ||
      !Array.isArray(output.content)
    ) continue
    for (const content of output.content) {
      if (!content || typeof content !== 'object' || !('type' in content)) {
        continue
      }
      if (
        content.type === 'refusal' && 'refusal' in content &&
        typeof content.refusal === 'string'
      ) {
        return { refusal: content.refusal }
      }
      if (
        content.type === 'output_text' && 'text' in content &&
        typeof content.text === 'string'
      ) {
        return { text: content.text }
      }
    }
  }
  return {}
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request) })
  }
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405)
  }

  const {
    url: supabaseUrl,
    publishableKey,
    secretKey,
  } = projectCredentials()
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!supabaseUrl || !publishableKey || !secretKey || !openaiKey) {
    return jsonResponse(request, {
      error: 'The analysis service is not configured.',
    }, 503)
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse(request, { error: 'Authentication required.' }, 401)
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const serviceClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const token = authorization.slice('Bearer '.length)
  const { data: userData, error: userError } = await userClient.auth.getUser(
    token,
  )
  const user = userData.user
  if (userError || !user?.email) {
    return jsonResponse(request, {
      error: 'Your session is invalid or expired.',
    }, 401)
  }

  const { data: allowed } = await serviceClient
    .from('allowed_users')
    .select('email')
    .eq('email', user.email.toLowerCase())
    .maybeSingle()
  if (!allowed) {
    return jsonResponse(request, {
      error: 'This account has not been invited.',
    }, 403)
  }

  let body: AnalyzeBody
  try {
    body = await request.json()
  } catch {
    return jsonResponse(
      request,
      { error: 'Request body must be valid JSON.' },
      400,
    )
  }

  const mode = body.mode
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : ''
  if (mode !== 'text' && mode !== 'photo') {
    return jsonResponse(request, { error: 'Mode must be text or photo.' }, 400)
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return jsonResponse(
      request,
      { error: 'Meal description is too long.' },
      413,
    )
  }
  if (mode === 'text' && text.length < 3) {
    return jsonResponse(request, {
      error: 'Describe the meal in a little more detail.',
    }, 400)
  }
  if (mode === 'photo') {
    if (
      !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl)
    ) {
      return jsonResponse(request, {
        error: 'Photo must be a JPEG, PNG or WebP data URL.',
      }, 400)
    }
    if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return jsonResponse(request, {
        error: 'Photo is too large after compression.',
      }, 413)
    }
  }

  const dailyLimit = Number(
    Deno.env.get('AI_DAILY_LIMIT') ?? DEFAULT_DAILY_LIMIT,
  )
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await serviceClient
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)
  if ((count ?? 0) >= dailyLimit) {
    await serviceClient.from('ai_usage').insert({
      user_id: user.id,
      input_type: mode,
      model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6-luna',
      status: 'rate_limited',
    })
    return jsonResponse(request, {
      error: `Daily analysis limit reached (${dailyLimit}). Try again later.`,
    }, 429)
  }

  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6-luna'
  const content: Array<Record<string, unknown>> = [
    {
      type: 'input_text',
      text: mode === 'text'
        ? `Estimate this meal: ${text}`
        : `Estimate the complete meal in this photograph.${text ? ` User context: ${text}` : ''}`,
    },
  ]
  if (mode === 'photo') {
    content.push({
      type: 'input_image',
      image_url: imageDataUrl,
      detail: 'auto',
    })
  }

  let openaiResponse: Response
  let openaiJson: Record<string, unknown> = {}
  try {
    openaiResponse = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions,
        input: [{ role: 'user', content }],
        text: {
          format: {
            type: 'json_schema',
            name: 'meal_analysis',
            strict: true,
            schema: mealAnalysisSchema,
          },
        },
        reasoning: { effort: 'none' },
        max_output_tokens: 1_400,
        store: false,
      }),
      signal: AbortSignal.timeout(55_000),
    })
    openaiJson = await openaiResponse.json() as Record<string, unknown>
  } catch (error) {
    console.error(
      'OpenAI request failed',
      error instanceof Error ? error.message : 'unknown error',
    )
    await serviceClient.from('ai_usage').insert({
      user_id: user.id,
      input_type: mode,
      model,
      status: 'error',
    })
    return jsonResponse(request, {
      error: 'The nutrition service did not respond in time.',
    }, 504)
  }

  const usage = openaiJson.usage && typeof openaiJson.usage === 'object'
    ? openaiJson.usage as Record<string, unknown>
    : {}
  const requestId = openaiResponse.headers.get('x-request-id') ??
    (typeof openaiJson.id === 'string' ? openaiJson.id : null)

  const logUsage = async (
    status: 'success' | 'refused' | 'incomplete' | 'error',
  ) => {
    const { error } = await serviceClient.from('ai_usage').insert({
      user_id: user.id,
      input_type: mode,
      model,
      openai_request_id: requestId,
      input_tokens: typeof usage.input_tokens === 'number' ? usage.input_tokens : null,
      output_tokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : null,
      status,
    })
    if (error) console.error('Could not record AI usage', error.message)
  }

  if (!openaiResponse.ok) {
    console.error('OpenAI API error', openaiResponse.status, requestId)
    await logUsage('error')
    return jsonResponse(request, {
      error: 'Meal analysis failed. Please try again.',
    }, 502)
  }
  if (openaiJson.status === 'incomplete') {
    await logUsage('incomplete')
    return jsonResponse(request, {
      error: 'The analysis was incomplete. Try a clearer or shorter input.',
    }, 502)
  }

  const output = extractOutput(openaiJson)
  if (output.refusal) {
    await logUsage('refused')
    return jsonResponse(
      request,
      { error: 'This input could not be analysed.' },
      422,
    )
  }
  if (!output.text) {
    await logUsage('error')
    return jsonResponse(request, {
      error: 'The analysis returned no usable result.',
    }, 502)
  }

  let analysis: unknown
  try {
    analysis = JSON.parse(output.text)
  } catch {
    await logUsage('error')
    return jsonResponse(request, {
      error: 'The analysis result was malformed.',
    }, 502)
  }
  const validationError = validateMealAnalysis(analysis)
  if (validationError) {
    console.error(
      'Structured analysis validation failed',
      validationError,
      requestId,
    )
    await logUsage('error')
    return jsonResponse(request, {
      error: 'The estimate failed server validation. Please retry.',
    }, 502)
  }

  await logUsage('success')
  return jsonResponse(request, analysis)
})
