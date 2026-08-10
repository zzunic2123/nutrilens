import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { validateMealAnalysis } from './meal-schema.ts'

const validAnalysis = {
  schema_version: '1.0',
  status: 'estimated',
  title: 'Chicken bowl',
  description: 'Chicken with rice and vegetables.',
  detected_foods: [],
  nutrition: {
    calories_kcal: 650,
    protein_g: 50,
    carbs_g: 70,
    fat_g: 20,
    fiber_g: 8,
  },
  confidence: 'medium',
  assumptions: [],
  clarification_question: null,
}

Deno.test('accepts a complete meal analysis', () => {
  assertEquals(validateMealAnalysis(validAnalysis), null)
})

Deno.test('rejects negative nutrition', () => {
  assertEquals(
    validateMealAnalysis({
      ...validAnalysis,
      nutrition: { ...validAnalysis.nutrition, protein_g: -2 },
    }),
    'Nutrition cannot be negative.',
  )
})

Deno.test('requires macro totals for estimated meals', () => {
  assertEquals(
    validateMealAnalysis({
      ...validAnalysis,
      nutrition: { ...validAnalysis.nutrition, fat_g: null },
    }),
    'Estimated nutrition is incomplete.',
  )
})

Deno.test('rejects malformed detected foods after schema parsing', () => {
  assertEquals(
    validateMealAnalysis({
      ...validAnalysis,
      detected_foods: [{ name: 'Rice', estimated_grams: -20, preparation: null }],
    }),
    'Detected foods are invalid.',
  )
})
