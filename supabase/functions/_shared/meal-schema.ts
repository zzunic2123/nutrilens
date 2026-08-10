export const mealAnalysisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    schema_version: { type: 'string', enum: ['1.0'] },
    status: {
      type: 'string',
      enum: ['estimated', 'needs_clarification', 'not_food'],
    },
    title: { type: 'string' },
    description: { type: 'string' },
    detected_foods: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          estimated_grams: { type: ['number', 'null'] },
          preparation: { type: ['string', 'null'] },
        },
        required: ['name', 'estimated_grams', 'preparation'],
      },
    },
    nutrition: {
      type: 'object',
      additionalProperties: false,
      properties: {
        calories_kcal: { type: ['number', 'null'] },
        protein_g: { type: ['number', 'null'] },
        carbs_g: { type: ['number', 'null'] },
        fat_g: { type: ['number', 'null'] },
        fiber_g: { type: ['number', 'null'] },
      },
      required: ['calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'],
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    assumptions: { type: 'array', items: { type: 'string' } },
    clarification_question: { type: ['string', 'null'] },
  },
  required: [
    'schema_version',
    'status',
    'title',
    'description',
    'detected_foods',
    'nutrition',
    'confidence',
    'assumptions',
    'clarification_question',
  ],
} as const

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null ||
    (typeof value === 'number' && Number.isFinite(value))
}

export function validateMealAnalysis(value: unknown): string | null {
  if (!isRecord(value)) return 'Response is not an object.'
  if (value.schema_version !== '1.0') return 'Unknown analysis schema version.'
  if (
    !['estimated', 'needs_clarification', 'not_food'].includes(
      String(value.status),
    )
  ) return 'Invalid analysis status.'
  if (
    typeof value.title !== 'string' || typeof value.description !== 'string'
  ) return 'Missing meal description.'
  if (!value.title.trim() || value.title.length > 160 || value.description.length > 2_000) {
    return 'Meal description is outside allowed bounds.'
  }
  if (!['low', 'medium', 'high'].includes(String(value.confidence))) {
    return 'Invalid confidence.'
  }
  if (
    !Array.isArray(value.detected_foods) || !Array.isArray(value.assumptions)
  ) return 'Invalid analysis lists.'
  if (
    value.detected_foods.length > 30 ||
    !value.detected_foods.every((food) =>
      isRecord(food) && typeof food.name === 'string' && food.name.length > 0 &&
      isNullableFiniteNumber(food.estimated_grams) &&
      (food.estimated_grams === null || food.estimated_grams >= 0) &&
      (food.preparation === null || typeof food.preparation === 'string')
    )
  ) return 'Detected foods are invalid.'
  if (
    value.assumptions.length > 30 ||
    !value.assumptions.every((assumption) => typeof assumption === 'string')
  ) return 'Assumptions are invalid.'
  if (
    value.clarification_question !== null &&
    typeof value.clarification_question !== 'string'
  ) return 'Clarification question is invalid.'
  const nutrition = value.nutrition
  if (!isRecord(nutrition)) return 'Missing nutrition object.'

  const values = ['calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g']
    .map(
      (key) => nutrition[key],
    )
  if (!values.every(isNullableFiniteNumber)) {
    return 'Nutrition contains invalid numbers.'
  }
  if (values.some((number) => typeof number === 'number' && number < 0)) {
    return 'Nutrition cannot be negative.'
  }

  if (value.status === 'estimated') {
    const required = values.slice(0, 4)
    if (required.some((number) => typeof number !== 'number')) {
      return 'Estimated nutrition is incomplete.'
    }
    const [calories, protein, carbs, fat] = required as number[]
    if (calories > 20_000 || Math.max(protein, carbs, fat) > 2_000) {
      return 'Nutrition is outside allowed bounds.'
    }
  }
  return null
}
