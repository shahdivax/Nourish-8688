import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Camera, Image, Loader2, Pencil, ImagePlus, X, AlertTriangle, Sparkles, Upload } from 'lucide-react';
import type { FoodEntry } from '../lib/storage';
import { getAIConfig } from '../lib/storage';
import { makeClient, anthropicChatCompletion, geminiChatCompletion } from '../lib/aiProvider';
import { AIErrorModal, parseAIError } from '../components/AIErrorModal';
import type { AIErrorInfo } from '../components/AIErrorModal';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
const UNITS = ['g', 'ml', 'count', 'oz', 'cup', 'tbsp', 'tsp'];

interface LogPageProps {
  currentDate: string;
  editEntry: FoodEntry | null;
  onAdd: (entry: FoodEntry) => void;
  onUpdate: (entry: FoodEntry) => void;
  onClearEdit: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Image compression ─────────────────────────────────────────────────────────

async function compressImage(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82).split(',')[1]);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── AI helpers ────────────────────────────────────────────────────────────────

interface AIEstimate {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes?: string;
}

function parseEstimateJSON(raw: string): AIEstimate {
  // Strip markdown code fences if model adds them
  const clean = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const parsed = JSON.parse(clean) as Partial<AIEstimate>;
  return {
    name: String(parsed.name ?? ''),
    calories: Number(parsed.calories ?? 0),
    protein: Number(parsed.protein ?? 0),
    carbs: Number(parsed.carbs ?? 0),
    fat: Number(parsed.fat ?? 0),
    notes: parsed.notes ? String(parsed.notes) : undefined,
  };
}

async function aiEstimateFromText(
  name: string,
  quantity: string,
  unit: string,
): Promise<AIEstimate> {
  const cfg = getAIConfig();
  if (!cfg?.apiKey || !cfg.model) throw new Error('no_config');

  const quantityStr = quantity ? `, ${quantity} ${unit}` : '';
  const prompt = `Estimate the nutrition for: "${name}"${quantityStr}.
Return ONLY a JSON object with these exact fields:
{ "name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "notes": string }
Use 0 for unknown values. No markdown, no explanation.`;

  let raw: string;
  if (cfg.provider === 'anthropic') {
    raw = await anthropicChatCompletion(cfg.apiKey, cfg.model, [{ role: 'user', content: prompt }], 300);
  } else if (cfg.provider === 'gemini') {
    raw = await geminiChatCompletion(cfg.apiKey, cfg.model, [{ text: prompt }], 300);
  } else {
    // OpenAI via SDK
    const client = makeClient(cfg.provider, cfg.apiKey);
    const res = await client.chat.completions.create({
      model: cfg.model,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    raw = res.choices[0]?.message?.content ?? '';
  }

  if (!raw) throw new Error('Empty response from AI model');
  return parseEstimateJSON(raw);
}

async function aiEstimateFromImage(
  base64: string,
  mode: 'label' | 'identify',
): Promise<AIEstimate> {
  const cfg = getAIConfig();
  if (!cfg?.apiKey || !cfg.model) throw new Error('no_config');

  const prompt =
    mode === 'label'
      ? `This is a nutrition label photo. Extract the nutritional information and return ONLY a JSON object:
{ "name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "notes": string }
Use 0 for any missing values. No markdown, no explanation.`
      : `This is a photo of food. Estimate the nutrition for what you see and return ONLY a JSON object:
{ "name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "notes": string }
No markdown, no explanation.`;

  let raw: string;
  if (cfg.provider === 'anthropic') {
    // Anthropic native API (no CORS issues)
    raw = await anthropicChatCompletion(
      cfg.apiKey,
      cfg.model,
      [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
      400,
    );
  } else if (cfg.provider === 'gemini') {
    // Gemini native generateContent — supports inline_data for images
    raw = await geminiChatCompletion(
      cfg.apiKey,
      cfg.model,
      [
        { inline_data: { mime_type: 'image/jpeg', data: base64 } },
        { text: prompt },
      ],
      400,
    );
  } else {
    // OpenAI via SDK — supports image_url with base64 data URLs
    const client = makeClient(cfg.provider, cfg.apiKey);
    const res = await client.chat.completions.create({
      model: cfg.model,
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });
    raw = res.choices[0]?.message?.content ?? '';
  }

  if (!raw) throw new Error('Empty response from AI model');
  return parseEstimateJSON(raw);
}

async function aiReestimate(
  name: string,
  quantity: string,
  unit: string,
  description: string,
  changedField: string,
): Promise<AIEstimate> {
  const cfg = getAIConfig();
  if (!cfg?.apiKey || !cfg.model) throw new Error('no_config');

  const parts = [`"${name}"`];
  if (quantity) parts.push(`${quantity} ${unit}`);
  if (description) parts.push(`described as "${description}"`);

  const prompt = `I'm logging food: ${parts.join(', ')}.
The "${changedField}" field just changed. Re-estimate all nutrition values accordingly.
Return ONLY a JSON object:
{ "name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "notes": string }
No markdown, no explanation.`;

  let raw: string;
  if (cfg.provider === 'anthropic') {
    raw = await anthropicChatCompletion(cfg.apiKey, cfg.model, [{ role: 'user', content: prompt }], 300);
  } else if (cfg.provider === 'gemini') {
    raw = await geminiChatCompletion(cfg.apiKey, cfg.model, [{ text: prompt }], 300);
  } else {
    // OpenAI via SDK
    const client = makeClient(cfg.provider, cfg.apiKey);
    const res = await client.chat.completions.create({
      model: cfg.model,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    raw = res.choices[0]?.message?.content ?? '';
  }

  if (!raw) throw new Error('Empty response from AI model');
  return parseEstimateJSON(raw);
}

// ── Manual Log ───────────────────────────────────────────────────────────────

interface ManualLogProps {
  currentDate: string;
  editEntry: FoodEntry | null;
  onAdd: (entry: FoodEntry) => void;
  onUpdate: (entry: FoodEntry) => void;
  onClearEdit: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onAIError: (err: AIErrorInfo) => void;
}

function ManualLog({ currentDate, editEntry, onAdd, onUpdate, onClearEdit, onToast, onAIError }: ManualLogProps) {
  const blankForm = {
    name: '',
    description: '',
    mealType: 'breakfast' as typeof MEAL_TYPES[number],
    quantity: '',
    unit: 'g',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  };

  const [form, setForm] = useState(blankForm);
  const [showMacros, setShowMacros] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shakeName, setShakeName] = useState(false);
  const [zeroCalWarning, setZeroCalWarning] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressingPhoto, setCompressingPhoto] = useState(false);
  const [aiGuessing, setAiGuessing] = useState(false);
  const [aiReestimating, setAiReestimating] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editEntry) {
      setForm({
        name: editEntry.name,
        description: editEntry.description || '',
        mealType: editEntry.mealType,
        quantity: String(editEntry.quantity),
        unit: editEntry.unit,
        calories: String(editEntry.calories),
        protein: String(editEntry.protein || ''),
        carbs: String(editEntry.carbs || ''),
        fat: String(editEntry.fat || ''),
      });
      setShowMacros(!!(editEntry.protein || editEntry.carbs || editEntry.fat));
      setImageBase64(editEntry.imageBase64);
      setImagePreview(editEntry.imageBase64 ? `data:image/jpeg;base64,${editEntry.imageBase64}` : null);
    } else {
      setForm(blankForm);
      setShowMacros(false);
      setImageBase64(undefined);
      setImagePreview(null);
    }
    setZeroCalWarning(false);
  }, [editEntry?.id]);

  const set = useCallback((k: string, v: string) => setForm(f => ({ ...f, [k]: v })), []);

  const handlePhotoSelect = async (file: File) => {
    if (file.size > 3_000_000) onToast('Compressing large image…', 'info');
    setCompressingPhoto(true);
    try {
      const b64 = await compressImage(file);
      setImageBase64(b64);
      setImagePreview(`data:image/jpeg;base64,${b64}`);
    } catch {
      onToast('Could not process image', 'error');
    } finally {
      setCompressingPhoto(false);
    }
  };

  const cfg = getAIConfig();

  const handleAiGuess = async () => {
    if (!form.name.trim()) {
      setShakeName(true);
      setTimeout(() => setShakeName(false), 500);
      nameInputRef.current?.focus();
      onToast('Enter a food name first', 'error');
      return;
    }
    setAiGuessing(true);
    try {
      const est = await aiEstimateFromText(form.name, form.quantity, form.unit);
      setForm(f => ({
        ...f,
        calories: String(est.calories),
        protein: String(est.protein),
        carbs: String(est.carbs),
        fat: String(est.fat),
      }));
      setShowMacros(true);
      onToast('AI filled in nutrition ✓');
    } catch (err) {
      onAIError(parseAIError(err, cfg?.provider));
    } finally {
      setAiGuessing(false);
    }
  };

  const handleAiReestimate = async (changedField: string) => {
    if (!cfg?.apiKey || !form.name.trim()) return;
    setAiReestimating(true);
    try {
      const est = await aiReestimate(form.name, form.quantity, form.unit, form.description, changedField);
      setForm(f => ({
        ...f,
        calories: String(est.calories),
        protein: String(est.protein),
        carbs: String(est.carbs),
        fat: String(est.fat),
      }));
      setShowMacros(true);
      onToast('AI updated nutrition ✓');
    } catch (err) {
      // Silent on re-estimate — only show modal for serious errors (not no_config)
      const parsed = parseAIError(err, cfg?.provider);
      if (parsed.title !== 'AI not configured') onAIError(parsed);
    } finally {
      setAiReestimating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setShakeName(true);
      setTimeout(() => setShakeName(false), 500);
      nameInputRef.current?.focus();
      return;
    }
    const cals = Math.round(parseFloat(form.calories)) || 0;
    if (cals === 0 && !zeroCalWarning) {
      setZeroCalWarning(true);
      return;
    }
    setZeroCalWarning(false);
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 160));
    const base = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      mealType: form.mealType,
      quantity: parseFloat(form.quantity) || 1,
      unit: form.unit,
      calories: cals,
      protein: parseFloat(form.protein) || 0,
      carbs: parseFloat(form.carbs) || 0,
      fat: parseFloat(form.fat) || 0,
      date: editEntry ? editEntry.date : currentDate,
      timestamp: editEntry ? editEntry.timestamp : Date.now(),
      imageBase64,
    };
    if (editEntry) {
      onUpdate({ ...base, id: editEntry.id });
    } else {
      onAdd({ ...base, id: crypto.randomUUID() });
    }
    setForm(blankForm);
    setShowMacros(false);
    setImageBase64(undefined);
    setImagePreview(null);
    setSubmitting(false);
  };

  const isEditing = !!editEntry;
  const hasAI = !!(cfg?.apiKey && cfg.model);

  return (
    <>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .input-shake { animation: shake 0.45s ease; }
      `}</style>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {isEditing && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: 10,
            background: 'var(--accent-light)', border: '1.5px solid var(--accent)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pencil size={14} color="var(--accent)" />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                Editing: {editEntry.name}
              </span>
            </div>
            <button
              type="button" onClick={onClearEdit}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)', minHeight: 44, padding: '0 8px' }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Food name */}
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Food name</label>
          <input
            ref={nameInputRef}
            className={`input${shakeName ? ' input-shake' : ''}`}
            placeholder="e.g. Greek Yogurt"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            style={{ border: shakeName ? '2px solid #E11D48' : undefined }}
          />
        </div>

        {/* Description */}
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Description (optional)</label>
          <input
            className="input"
            placeholder="e.g. Full fat, plain"
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
        </div>

        {/* Meal type */}
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Meal</label>
          <div className="segmented">
            {MEAL_TYPES.map(m => (
              <button key={m} type="button" className={form.mealType === m ? 'active' : ''} onClick={() => set('mealType', m)} style={{ textTransform: 'capitalize' }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity + unit */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 2 }}>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Quantity</label>
            <input
              className="input" type="number" placeholder="100"
              value={form.quantity}
              onChange={e => set('quantity', e.target.value)}
              onBlur={() => isEditing && hasAI && form.name.trim() && handleAiReestimate('quantity')}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Unit</label>
            <select
              className="input"
              value={form.unit}
              onChange={e => set('unit', e.target.value)}
              onBlur={() => isEditing && hasAI && form.name.trim() && handleAiReestimate('unit')}
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* Calories + AI guess */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label className="label-caps">Calories (kcal)</label>
            <button
              type="button"
              onClick={handleAiGuess}
              disabled={aiGuessing || aiReestimating}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'var(--accent-light)', border: 'none', borderRadius: 8,
                padding: '4px 10px', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600,
                color: 'var(--accent)', opacity: (aiGuessing || aiReestimating) ? 0.6 : 1,
                minHeight: 28,
              }}
            >
              {(aiGuessing || aiReestimating) ? (
                <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Sparkles size={11} />
              )}
              {aiGuessing ? 'Estimating…' : aiReestimating ? 'Updating…' : 'AI Guess'}
            </button>
          </div>
          <input
            className="input" type="number" placeholder="e.g. 150"
            value={form.calories}
            onChange={e => { set('calories', e.target.value); setZeroCalWarning(false); }}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 18 }}
          />
          {zeroCalWarning && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginTop: 8, padding: '10px 12px',
              background: '#FEF3C7', border: '1.5px solid #D97706', borderRadius: 10,
            }}>
              <AlertTriangle size={15} color="#D97706" />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#92400E', flex: 1 }}>
                Are you sure? 0 kcal logged.
              </span>
              <button type="button" onClick={() => setZeroCalWarning(false)}
                style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#D97706', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '0 4px', minHeight: 32 }}>
                Cancel
              </button>
              <button type="submit"
                style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#92400E', background: '#FDE68A', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '4px 10px', borderRadius: 6, minHeight: 32 }}>
                Log 0 kcal
              </button>
            </div>
          )}
        </div>

        {/* Macros toggle */}
        <button
          type="button"
          onClick={() => setShowMacros(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
            color: 'var(--accent)', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600,
            minHeight: 44,
          }}
        >
          <ChevronDown size={16} style={{ transform: showMacros ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          {showMacros ? 'Hide' : 'Add'} macros (optional)
        </button>

        {showMacros && (
          <div style={{ display: 'flex', gap: 10 }}>
            {(['protein', 'carbs', 'fat'] as const).map(macro => (
              <div key={macro} style={{ flex: 1 }}>
                <label className="label-caps" style={{ display: 'block', marginBottom: 8, textTransform: 'capitalize' }}>{macro} (g)</label>
                <input
                  className="input" type="number" placeholder="0"
                  value={form[macro]}
                  onChange={e => set(macro, e.target.value)}
                  onBlur={() => isEditing && hasAI && form.name.trim() && handleAiReestimate(macro)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Photo */}
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Photo (optional)</label>
          <input
            ref={photoInputRef}
            type="file" accept="image/*"
            style={{ display: 'none' }}
            onChange={async e => {
              const file = e.target.files?.[0];
              if (file) await handlePhotoSelect(file);
              e.target.value = '';
            }}
          />
          {imagePreview ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img src={imagePreview} alt="Food preview" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12, border: '2px solid var(--border)', display: 'block' }} />
              <button type="button" onClick={() => { setImageBase64(undefined); setImagePreview(null); }}
                style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: '#E11D48', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                <X size={12} color="white" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => photoInputRef.current?.click()} disabled={compressingPhoto}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', border: '2px dashed var(--border)', borderRadius: 12, background: 'var(--subtle)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)', minHeight: 48 }}>
              {compressingPhoto ? (
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
              ) : (
                <ImagePlus size={16} color="var(--accent)" />
              )}
              {compressingPhoto ? 'Compressing…' : 'Add photo'}
            </button>
          )}
        </div>

        {/* Submit */}
        {!zeroCalWarning && (
          <button type="submit" className="btn-primary" disabled={submitting}
            style={{ marginTop: 8, opacity: submitting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {submitting && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {submitting ? (isEditing ? 'Saving…' : 'Logging…') : (isEditing ? 'Save Changes' : 'Log Food')}
          </button>
        )}
      </form>
    </>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="skeleton" style={{ height: 18, width: '60%' }} />
      <div className="skeleton" style={{ height: 14, width: '80%' }} />
      <div className="skeleton" style={{ height: 14, width: '40%' }} />
    </div>
  );
}

// ── AI Scan ──────────────────────────────────────────────────────────────────

interface AIScanProps {
  currentDate: string;
  onAdd: (entry: FoodEntry) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onAIError: (err: AIErrorInfo) => void;
}

function AIScan({ currentDate, onAdd, onAIError }: AIScanProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIEstimate | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    mealType: 'lunch' as typeof MEAL_TYPES[number],
  });

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const triggerModeRef = useRef<'label' | 'identify'>('identify');

  const handleFileChosen = async (file: File) => {
    const cfg = getAIConfig();
    if (!cfg?.apiKey || !cfg.model) {
      onAIError(parseAIError(new Error('no_config')));
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const base64 = await compressImage(file, 1024);
      const est = await aiEstimateFromImage(base64, triggerModeRef.current);
      setResult(est);
      setEditForm({
        name: est.name || '',
        calories: String(est.calories || ''),
        protein: String(est.protein || ''),
        carbs: String(est.carbs || ''),
        fat: String(est.fat || ''),
        mealType: 'lunch',
      });
    } catch (err) {
      onAIError(parseAIError(err, cfg?.provider));
    } finally {
      setLoading(false);
    }
  };

  const triggerPicker = (mode: 'label' | 'identify', source: 'camera' | 'gallery') => {
    triggerModeRef.current = mode;
    setTimeout(() => {
      if (source === 'camera') cameraRef.current?.click();
      else galleryRef.current?.click();
    }, 50);
  };

  const handleConfirm = () => {
    const entry: FoodEntry = {
      id: crypto.randomUUID(),
      name: editForm.name || 'Unknown food',
      mealType: editForm.mealType,
      quantity: 1,
      unit: 'count',
      calories: Math.round(parseFloat(editForm.calories)) || 0,
      protein: parseFloat(editForm.protein) || 0,
      carbs: parseFloat(editForm.carbs) || 0,
      fat: parseFloat(editForm.fat) || 0,
      date: currentDate,
      timestamp: Date.now(),
    };
    onAdd(entry);
    setResult(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonCard /><SkeletonCard />
        <div style={{ textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>
          Analysing your image…
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label-caps" style={{ marginBottom: 12, color: 'var(--accent)' }}>✓ Food identified</div>
          {result.notes && (
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, fontStyle: 'italic' }}>
              {result.notes}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Food name</label>
              <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Calories (kcal)</label>
              <input className="input" type="number" value={editForm.calories} onChange={e => setEditForm(f => ({ ...f, calories: e.target.value }))} style={{ fontFamily: 'var(--font-mono)', fontSize: 18 }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['protein', 'carbs', 'fat'] as const).map(macro => (
                <div key={macro} style={{ flex: 1 }}>
                  <label className="label-caps" style={{ display: 'block', marginBottom: 8, textTransform: 'capitalize' }}>{macro} (g)</label>
                  <input className="input" type="number" value={editForm[macro]} onChange={e => setEditForm(f => ({ ...f, [macro]: e.target.value }))} style={{ fontFamily: 'var(--font-mono)' }} />
                </div>
              ))}
            </div>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Meal</label>
              <div className="segmented">
                {MEAL_TYPES.map(m => (
                  <button key={m} type="button" className={editForm.mealType === m ? 'active' : ''} onClick={() => setEditForm(f => ({ ...f, mealType: m }))} style={{ textTransform: 'capitalize' }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={() => setResult(null)}>Discard</button>
          <button className="btn-primary" onClick={handleConfirm}>Log Food</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Hidden file inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChosen(f); e.target.value = ''; }} />
      <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChosen(f); e.target.value = ''; }} />

      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
        Scan a nutrition label or photograph your meal — AI will fill in all the details.
      </p>

      {/* Scan Label */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '2px solid var(--border)' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Camera size={20} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Scan a Label</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)' }}>Point at nutrition facts panel</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <button onClick={() => triggerPicker('label', 'camera')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 12px', background: 'none', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
            <Camera size={15} /> Camera
          </button>
          <button onClick={() => triggerPicker('label', 'gallery')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
            <Upload size={15} /> Gallery
          </button>
        </div>
      </div>

      {/* Identify Food */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '2px solid var(--border)' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Image size={20} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Identify Food</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)' }}>AI estimates from a meal photo</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <button onClick={() => triggerPicker('identify', 'camera')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 12px', background: 'none', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
            <Camera size={15} /> Camera
          </button>
          <button onClick={() => triggerPicker('identify', 'gallery')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
            <Upload size={15} /> Gallery
          </button>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--subtle)', border: '2px solid var(--border)' }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          <strong>Requires an AI model.</strong> Configure one in Settings → AI Scan.
        </p>
      </div>
    </div>
  );
}

// ── Log Page ──────────────────────────────────────────────────────────────────

export default function LogPage({ currentDate, editEntry, onAdd, onUpdate, onClearEdit, onToast }: LogPageProps) {
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [aiError, setAiError] = useState<AIErrorInfo | null>(null);

  useEffect(() => {
    if (editEntry) setMode('manual');
  }, [editEntry]);

  return (
    <div style={{ padding: '0 0 80px', maxWidth: 430, margin: '0 auto', minHeight: '100vh' }}>
      <div style={{ padding: '52px 20px 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--text)', margin: '0 0 16px' }}>
          {editEntry ? 'Edit Entry' : 'Log Food'}
        </h1>
        {!editEntry && (
          <div className="segmented">
            <button className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>Manual</button>
            <button className={mode === 'ai' ? 'active' : ''} onClick={() => setMode('ai')}>AI Scan</button>
          </div>
        )}
      </div>

      <div style={{ padding: '0 20px' }}>
        {mode === 'manual' || editEntry ? (
          <ManualLog
            currentDate={currentDate}
            editEntry={editEntry}
            onAdd={onAdd}
            onUpdate={onUpdate}
            onClearEdit={onClearEdit}
            onToast={onToast}
            onAIError={setAiError}
          />
        ) : (
          <AIScan
            currentDate={currentDate}
            onAdd={onAdd}
            onToast={onToast}
            onAIError={setAiError}
          />
        )}
      </div>

      <AIErrorModal error={aiError} onClose={() => setAiError(null)} />
    </div>
  );
}
