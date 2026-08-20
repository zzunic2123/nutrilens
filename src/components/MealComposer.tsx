import { AlertCircle, ArrowLeft, ArrowRight, Camera, Check, ImagePlus, Info, Keyboard, LoaderCircle, Plus, Sparkles, Type, UtensilsCrossed, WandSparkles } from 'lucide-preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import type { ComposerMealSource, MealAnalysis, MealDraft, MealSource, Nutrition } from '../types'
import { useApp } from '../contexts/AppContext'
import { compressMealImage, dataUrlSizeInBytes } from '../lib/image'
import { toLocalDateTimeInput } from '../lib/date'
import { detectedFoodsToMealItems } from '../lib/meals'
import { Modal } from './Modal'
import { ConfidenceBadge } from './NutritionUI'

type ComposerMode = ComposerMealSource
type Stage = 'choose' | 'input' | 'analyzing' | 'review'

interface MealComposerProps {
  open: boolean
  initialMode?: ComposerMealSource | null
  initialDateKey?: string
  onClose: () => void
}

const emptyNutrition = (): Nutrition => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: null })

const samplePrompts = [
  'Oats with banana and yoghurt',
  'Two slices of pizza and salad',
  'Chicken wrap with vegetables',
]

const analysisMessages = [
  'Looking at the meal composition…',
  'Estimating visible portions…',
  'Balancing calories and macros…',
  'Preparing an editable estimate…',
]

function newDraft(source: MealSource, dateKey?: string): MealDraft {
  return {
    eatenAt: dateKey ? new Date(`${dateKey}T12:00:00Z`).toISOString() : new Date().toISOString(),
    title: '',
    notes: null,
    source,
    nutrition: emptyNutrition(),
    confidence: null,
    items: [],
    isFavorite: false,
  }
}

export function MealComposer({ open, initialMode, initialDateKey, onClose }: MealComposerProps) {
  const { analyzeMeal, saveMeal, notify, demoMode } = useApp()
  const [mode, setMode] = useState<ComposerMode | null>(null)
  const [stage, setStage] = useState<Stage>('choose')
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoName, setPhotoName] = useState('')
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null)
  const [refinement, setRefinement] = useState('')
  const [draft, setDraft] = useState<MealDraft>(newDraft('manual'))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [analysisMessage, setAnalysisMessage] = useState(0)
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const nextMode = initialMode ?? null
    setMode(nextMode)
    setStage(nextMode ? (nextMode === 'manual' ? 'review' : 'input') : 'choose')
    setText('')
    setPhoto(null)
    setPhotoName('')
    setAnalysis(null)
    setRefinement('')
    setDraft(newDraft(nextMode ?? 'manual', initialDateKey))
    setError(null)
    setSaving(false)
    setAnalysisMessage(0)
  }, [initialDateKey, initialMode, open])

  useEffect(() => {
    if (stage !== 'analyzing') return
    const interval = window.setInterval(
      () => setAnalysisMessage((current) => (current + 1) % analysisMessages.length),
      1150,
    )
    return () => window.clearInterval(interval)
  }, [stage])

  const selectMode = (nextMode: ComposerMode) => {
    setMode(nextMode)
    setDraft(newDraft(nextMode, initialDateKey))
    setStage(nextMode === 'manual' ? 'review' : 'input')
    setError(null)
  }

  const handleFile = async (file?: File) => {
    if (!file) return
    setError(null)
    try {
      const compressed = await compressMealImage(file)
      if (dataUrlSizeInBytes(compressed) > 2_000_000) {
        throw new Error('The compressed photo is still too large. Try a tighter crop.')
      }
      setPhoto(compressed)
      setPhotoName(file.name)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not prepare that photo.')
    }
  }

  const openFilePicker = (input: HTMLInputElement | null) => {
    if (!input) return
    input.value = ''
    input.click()
  }

  const executeAnalysis = async (context: string, returnStage: 'input' | 'review') => {
    setStage('analyzing')
    setError(null)
    try {
      const result = await analyzeMeal(
        mode === 'photo_ai'
          ? { mode: 'photo', imageDataUrl: photo!, text: context || undefined }
          : { mode: 'text', text: context },
      )
      if (result.status === 'not_food') {
        setError('This does not appear to show or describe food. Try another input.')
        setStage(returnStage)
        return false
      }
      setAnalysis(result)
      setDraft((current) => ({
        eatenAt: current.eatenAt,
        title: result.title,
        notes: result.description || null,
        source: mode ?? 'text_ai',
        nutrition: {
          calories: result.nutrition.calories_kcal ?? 0,
          protein: result.nutrition.protein_g ?? 0,
          carbs: result.nutrition.carbs_g ?? 0,
          fat: result.nutrition.fat_g ?? 0,
          fiber: result.nutrition.fiber_g,
        },
        confidence: result.confidence,
        items: detectedFoodsToMealItems(result.detected_foods),
        isFavorite: current.isFavorite,
      }))
      setStage('review')
      return true
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The meal could not be analysed. Please try again.')
      setStage(returnStage)
      return false
    }
  }

  const runAnalysis = async () => {
    if (mode === 'text_ai' && text.trim().length < 3) {
      setError('Describe at least the main food and portion.')
      return
    }
    if (mode === 'photo_ai' && !photo) {
      setError('Choose or take a photo first.')
      return
    }
    await executeAnalysis(text.trim(), 'input')
  }

  const reprocessAnalysis = async () => {
    const detail = refinement.trim()
    if (detail.length < 2) {
      setError('Add the missing ingredient, quantity or correction first.')
      return
    }
    const context = [text.trim(), `Correction or additional detail: ${detail}`].filter(Boolean).join('\n')
    if (context.length > 2_000) {
      setError('The accumulated meal details are too long. Shorten the correction and try again.')
      return
    }
    const success = await executeAnalysis(context, 'review')
    if (success) {
      setText(context)
      setRefinement('')
    }
  }

  const updateNutrition = (key: keyof Nutrition, value: string) => {
    setDraft((current) => ({
      ...current,
      nutrition: {
        ...current.nutrition,
        [key]: value === '' && key === 'fiber' ? null : Number(value),
      },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveMeal(draft)
      notify({
        tone: 'success',
        title: 'Meal added',
        detail: `${draft.title} is now part of your day.`,
      })
      onClose()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save this meal.')
    } finally {
      setSaving(false)
    }
  }

  const title = stage === 'choose'
    ? 'How would you like to log?'
    : stage === 'analyzing'
      ? 'Reading your meal'
      : stage === 'review'
        ? analysis ? 'Review the estimate' : 'Add nutrition details'
        : mode === 'photo_ai' ? 'Add a meal photo' : 'Describe your meal'

  return (
    <Modal open={open} title={title} eyebrow={stage === 'review' ? 'Nothing saves until you confirm' : 'Log a meal'} onClose={onClose} wide={stage === 'review'}>
      {stage === 'choose' && (
        <div class="composer-choice">
          <button class="choice-card choice-card--photo" onClick={() => selectMode('photo_ai')}>
            <span><Camera size={26} /></span>
            <div><strong>Use a photo</strong><p>Take one now or choose from your gallery.</p></div>
            <ArrowRight size={19} />
          </button>
          <button class="choice-card choice-card--text" onClick={() => selectMode('text_ai')}>
            <span><Type size={26} /></span>
            <div><strong>Describe it</strong><p>Write naturally—no special format.</p></div>
            <ArrowRight size={19} />
          </button>
          <button class="choice-card choice-card--manual" onClick={() => selectMode('manual')}>
            <span><Keyboard size={25} /></span>
            <div><strong>Enter manually</strong><p>Use values you already know.</p></div>
            <ArrowRight size={19} />
          </button>
          <div class="privacy-inline"><Check size={15} /><span>Photos are resized in your browser and are not stored in your meal database.</span></div>
        </div>
      )}

      {stage === 'input' && mode === 'text_ai' && (
        <div class="composer-input">
          <button class="back-link" onClick={() => setStage('choose')}><ArrowLeft size={16} /> Other options</button>
          <label class="field field--large">
            <span>What did you eat?</span>
            <textarea
              rows={5}
              value={text}
              onInput={(event) => setText(event.currentTarget.value)}
              placeholder="For example: a bowl of oats with one banana, Greek yoghurt, walnuts and a little honey…"
              autoFocus
            />
            <small>Include quantities, cooking method, sauces and drinks when you know them.</small>
          </label>
          <div class="prompt-suggestions">
            <span>Try an example</span>
            <div>{samplePrompts.map((prompt) => <button onClick={() => setText(prompt)} key={prompt}>{prompt}</button>)}</div>
          </div>
          {error && <div class="form-error"><AlertCircle size={17} />{error}</div>}
          <button class="button button--primary button--full button--large" onClick={() => void runAnalysis()}>
            <WandSparkles size={19} /> Estimate nutrition
          </button>
          {demoMode && <p class="demo-helper"><Sparkles size={14} /> Demo mode returns a realistic sample estimate.</p>}
        </div>
      )}

      {stage === 'input' && mode === 'photo_ai' && (
        <div class="composer-input">
          <button class="back-link" onClick={() => setStage('choose')}><ArrowLeft size={16} /> Other options</button>
          <input
            ref={cameraInput}
            class="visually-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => void handleFile(event.currentTarget.files?.[0])}
          />
          <input
            ref={galleryInput}
            class="visually-hidden"
            type="file"
            accept="image/*"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => void handleFile(event.currentTarget.files?.[0])}
          />
          {photo ? (
            <div class="photo-preview">
              <img src={photo} alt="Meal ready to analyse" />
              <div class="photo-preview-copy"><span><Check size={15} /> Ready to analyse</span><small>{photoName} · {Math.round(dataUrlSizeInBytes(photo) / 1024)} KB</small></div>
              <div class="photo-preview-actions">
                <button class="button button--small button--secondary" onClick={() => openFilePicker(cameraInput.current)}><Camera size={14} /> Retake</button>
                <button class="button button--small button--secondary" onClick={() => openFilePicker(galleryInput.current)}><ImagePlus size={14} /> Replace</button>
              </div>
            </div>
          ) : (
            <div class="photo-dropzone">
              <span class="photo-dropzone-icon"><ImagePlus size={29} /></span>
              <strong>Add a clear photo of your meal</strong>
              <p>Keep the whole plate visible, with good natural light if possible.</p>
              <div class="photo-source-actions">
                <button class="button button--primary" onClick={() => openFilePicker(cameraInput.current)}><Camera size={17} /> Take a photo</button>
                <button class="button button--secondary" onClick={() => openFilePicker(galleryInput.current)}><ImagePlus size={17} /> Choose from gallery</button>
              </div>
            </div>
          )}
          <label class="field">
            <span>Anything the photo cannot show? <small>Optional</small></span>
            <input value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder="e.g. fried in one tablespoon of olive oil" />
          </label>
          {error && <div class="form-error"><AlertCircle size={17} />{error}</div>}
          <button class="button button--primary button--full button--large" onClick={() => void runAnalysis()} disabled={!photo}>
            <WandSparkles size={19} /> Analyse this meal
          </button>
          <p class="estimate-disclaimer"><Info size={14} /> Portions, oils and hidden ingredients cannot be known exactly from one image.</p>
        </div>
      )}

      {stage === 'analyzing' && (
        <div class="analysis-loading">
          {photo ? <img src={photo} alt="Meal being analysed" /> : <span class="analysis-text-icon"><UtensilsCrossed size={31} /></span>}
          <div class="analysis-pulse"><Sparkles size={19} /><i /><i /><i /></div>
          <h3>{analysisMessages[analysisMessage]}</h3>
          <p>Usually just a few seconds. The result will stay editable.</p>
          <div class="analysis-steps"><span class="done"><Check size={13} /> Input prepared</span><span class="active"><LoaderCircle size={13} /> Nutrition estimate</span><span>Review</span></div>
        </div>
      )}

      {stage === 'review' && (
        <div class="review-layout">
          <div class="review-main">
            {analysis?.status === 'needs_clarification' && (
              <div class="inline-alert inline-alert--warning">
                <AlertCircle size={18} />
                <div><strong>A little more context would help</strong><span>{analysis.clarification_question}</span></div>
                <button class="button button--small button--secondary" onClick={() => setStage('input')}>Add details</button>
              </div>
            )}
            <div class="review-heading-row">
              <div>
                {analysis && <ConfidenceBadge confidence={analysis.confidence} />}
                <h3>{analysis ? 'Check the estimate' : 'Meal details'}</h3>
                <p>{analysis ? 'Correct anything that does not match what you ate.' : 'Enter the nutrition shown on a label or from a source you trust.'}</p>
              </div>
              {analysis && <span class="review-ai-badge"><Sparkles size={15} /> AI estimate</span>}
            </div>
            <div class="form-grid form-grid--two">
              <label class="field field--span-two"><span>Meal name</span><input value={draft.title} onInput={(event) => setDraft({ ...draft, title: event.currentTarget.value })} placeholder="e.g. Chicken grain bowl" autoFocus={!analysis} /></label>
              <label class="field field--span-two"><span>Notes <small>Optional</small></span><input value={draft.notes ?? ''} onInput={(event) => setDraft({ ...draft, notes: event.currentTarget.value || null })} placeholder="Sauces, sides or anything worth remembering" /></label>
              <label class="field"><span>When</span><input type="datetime-local" required value={toLocalDateTimeInput(draft.eatenAt)} onInput={(event) => {
                if (event.currentTarget.value) {
                  setDraft({ ...draft, eatenAt: new Date(event.currentTarget.value).toISOString() })
                }
              }} /></label>
            </div>
            <div class="nutrition-editor">
              <label class="nutrition-input nutrition-input--calories"><span>Calories</span><div><input type="number" inputMode="decimal" min="0" value={draft.nutrition.calories} onInput={(event) => updateNutrition('calories', event.currentTarget.value)} /><em>kcal</em></div></label>
              <label class="nutrition-input nutrition-input--protein"><span>Protein</span><div><input type="number" inputMode="decimal" min="0" value={draft.nutrition.protein} onInput={(event) => updateNutrition('protein', event.currentTarget.value)} /><em>g</em></div></label>
              <label class="nutrition-input nutrition-input--carbs"><span>Carbs</span><div><input type="number" inputMode="decimal" min="0" value={draft.nutrition.carbs} onInput={(event) => updateNutrition('carbs', event.currentTarget.value)} /><em>g</em></div></label>
              <label class="nutrition-input nutrition-input--fat"><span>Fat</span><div><input type="number" inputMode="decimal" min="0" value={draft.nutrition.fat} onInput={(event) => updateNutrition('fat', event.currentTarget.value)} /><em>g</em></div></label>
              <label class="nutrition-input nutrition-input--fiber"><span>Fiber <small>Optional</small></span><div><input type="number" inputMode="decimal" min="0" value={draft.nutrition.fiber ?? ''} onInput={(event) => updateNutrition('fiber', event.currentTarget.value)} /><em>g</em></div></label>
            </div>
            {analysis && (
              <div class="refinement-editor">
                <div>
                  <span><WandSparkles size={16} /></span>
                  <p><strong>Tell NutriLens what it missed</strong><small>Add a quantity, hidden ingredient, sauce or correction, then reprocess the complete meal.</small></p>
                </div>
                <textarea
                  rows={2}
                  value={refinement}
                  onInput={(event) => setRefinement(event.currentTarget.value)}
                  placeholder="e.g. There were two eggs, and the dressing had one tablespoon of olive oil"
                />
                <button class="button button--secondary" onClick={() => void reprocessAnalysis()} disabled={!refinement.trim()}>
                  <WandSparkles size={17} /> Reprocess estimate
                </button>
              </div>
            )}
            {error && <div class="form-error"><AlertCircle size={17} />{error}</div>}
            <div class="review-actions">
              <button class="button button--secondary" onClick={() => analysis ? setStage('input') : setStage('choose')}><ArrowLeft size={17} /> Back</button>
              <button class="button button--primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? <LoaderCircle class="spin" size={18} /> : <Plus size={18} />}
                {saving ? 'Saving…' : 'Add to my day'}
              </button>
            </div>
          </div>

          {analysis && (
            <aside class="review-aside">
              {photo && <img class="review-photo" src={photo} alt="Analysed meal" />}
              <div class="detected-foods">
                <span class="eyebrow">What was detected</span>
                {analysis.detected_foods.map((food) => (
                  <div key={`${food.name}-${food.estimated_grams}`}>
                    <span><UtensilsCrossed size={14} /></span>
                    <p><strong>{food.name}</strong><small>{food.preparation ?? 'Preparation unclear'}</small></p>
                    <em>{food.estimated_grams ? `~${food.estimated_grams}g` : 'portion unclear'}</em>
                  </div>
                ))}
              </div>
              {analysis.assumptions.length > 0 && (
                <div class="assumptions"><span class="eyebrow">Assumptions</span><ul>{analysis.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></div>
              )}
              <p class="review-note"><Info size={15} /> Detected foods are saved with this meal so you can reopen and understand it later.</p>
            </aside>
          )}
        </div>
      )}
    </Modal>
  )
}
