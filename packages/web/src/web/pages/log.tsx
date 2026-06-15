import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2, Pencil, Sparkles } from 'lucide-react';
import { AIErrorModal, parseAIError } from '../components/AIErrorModal';
import type { AIErrorInfo } from '../components/AIErrorModal';
import { anthropicChatCompletion, geminiChatCompletion, makeClient } from '../lib/aiProvider';
import { getAIConfig } from '../lib/storage';
import type { FoodEntry } from '../lib/storage';

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

interface AIEstimate {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function parseEstimateJSON(raw: string): AIEstimate {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(clean) as Partial<AIEstimate>;
  return {
    name: String(parsed.name ?? ''),
    calories: Number(parsed.calories ?? 0),
    protein: Number(parsed.protein ?? 0),
    carbs: Number(parsed.carbs ?? 0),
    fat: Number(parsed.fat ?? 0),
  };
}

async function aiEstimateFromText(name: string, quantity: string, unit: string, description: string): Promise<AIEstimate> {
  const cfg = getAIConfig();
  if (!cfg?.apiKey || !cfg.model) throw new Error('no_config');

  const details = [
    `"${name}"`,
    quantity ? `${quantity} ${unit}` : '',
    description ? `described as "${description}"` : '',
  ].filter(Boolean).join(', ');
  const prompt = `Estimate calories and macros for this food: ${details}.
Return ONLY JSON with these exact fields:
{ "name": string, "calories": number, "protein": number, "carbs": number, "fat": number }
Use 0 for unknown values. No markdown.`;

  let raw: string;
  if (cfg.provider === 'anthropic') {
    raw = await anthropicChatCompletion(cfg.apiKey, cfg.model, [{ role: 'user', content: prompt }], 300);
  } else if (cfg.provider === 'gemini') {
    raw = await geminiChatCompletion(cfg.apiKey, cfg.model, [{ text: prompt }], 300);
  } else {
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

export default function LogPage({ currentDate, editEntry, onAdd, onUpdate, onClearEdit, onToast }: LogPageProps) {
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
  const [aiGuessing, setAiGuessing] = useState(false);
  const [shakeName, setShakeName] = useState(false);
  const [zeroCalWarning, setZeroCalWarning] = useState(false);
  const [aiError, setAiError] = useState<AIErrorInfo | null>(null);
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
    } else {
      setForm(blankForm);
      setShowMacros(false);
    }
    setZeroCalWarning(false);
  }, [editEntry?.id]);

  const set = useCallback((key: keyof typeof blankForm, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
  }, []);

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
      const estimate = await aiEstimateFromText(form.name, form.quantity, form.unit, form.description);
      setForm(current => ({
        ...current,
        calories: String(estimate.calories),
        protein: String(estimate.protein),
        carbs: String(estimate.carbs),
        fat: String(estimate.fat),
      }));
      setShowMacros(true);
      onToast('AI filled the estimate');
    } catch (err) {
      setAiError(parseAIError(err, getAIConfig()?.provider));
    } finally {
      setAiGuessing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setShakeName(true);
      setTimeout(() => setShakeName(false), 500);
      nameInputRef.current?.focus();
      return;
    }

    const calories = Math.round(parseFloat(form.calories)) || 0;
    if (calories === 0 && !zeroCalWarning) {
      setZeroCalWarning(true);
      return;
    }

    setSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 120));
    const base = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      mealType: form.mealType,
      quantity: parseFloat(form.quantity) || 1,
      unit: form.unit,
      calories,
      protein: parseFloat(form.protein) || 0,
      carbs: parseFloat(form.carbs) || 0,
      fat: parseFloat(form.fat) || 0,
      date: editEntry ? editEntry.date : currentDate,
      timestamp: editEntry ? editEntry.timestamp : Date.now(),
    };

    if (editEntry) onUpdate({ ...base, id: editEntry.id });
    else onAdd({ ...base, id: crypto.randomUUID() });

    setForm(blankForm);
    setShowMacros(false);
    setZeroCalWarning(false);
    setSubmitting(false);
  };

  const isEditing = !!editEntry;

  return (
    <div style={{ padding: '0 0 80px', maxWidth: 430, margin: '0 auto', minHeight: '100vh' }}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .input-shake { animation: shake 0.45s ease; }
      `}</style>

      <div style={{ padding: '52px 20px 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--text)', margin: '0 0 6px' }}>
          {isEditing ? 'Edit food' : 'Log food'}
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
          Manual calories only. Use AI Guess when you want a rough estimate.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {isEditing && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--accent-light)', border: '1.5px solid var(--accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pencil size={14} color="var(--accent)" />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Editing {editEntry.name}</span>
            </div>
            <button type="button" onClick={onClearEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)' }}>
              Cancel
            </button>
          </div>
        )}

        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Food name</label>
          <input
            ref={nameInputRef}
            className={`input${shakeName ? ' input-shake' : ''}`}
            placeholder="e.g. Greek yogurt"
            value={form.name}
            onChange={event => set('name', event.target.value)}
            style={{ borderRadius: 8, border: shakeName ? '2px solid #E11D48' : undefined }}
          />
        </div>

        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Description</label>
          <input
            className="input"
            placeholder="Optional details"
            value={form.description}
            onChange={event => set('description', event.target.value)}
            style={{ borderRadius: 8 }}
          />
        </div>

        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Meal</label>
          <div className="segmented">
            {MEAL_TYPES.map(meal => (
              <button key={meal} type="button" className={form.mealType === meal ? 'active' : ''} onClick={() => set('mealType', meal)} style={{ textTransform: 'capitalize' }}>
                {meal}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Quantity</label>
            <input className="input" type="number" placeholder="100" value={form.quantity} onChange={event => set('quantity', event.target.value)} style={{ borderRadius: 8 }} />
          </div>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Unit</label>
            <select className="input" value={form.unit} onChange={event => set('unit', event.target.value)} style={{ borderRadius: 8 }}>
              {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label className="label-caps">Calories</label>
            <button
              type="button"
              onClick={handleAiGuess}
              disabled={aiGuessing}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--accent-light)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', opacity: aiGuessing ? 0.65 : 1 }}
            >
              {aiGuessing ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={11} />}
              {aiGuessing ? 'Estimating' : 'AI Guess'}
            </button>
          </div>
          <input
            className="input"
            type="number"
            placeholder="e.g. 150"
            value={form.calories}
            onChange={event => { set('calories', event.target.value); setZeroCalWarning(false); }}
            style={{ borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 20 }}
          />
          {zeroCalWarning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '10px 12px', background: '#FEF3C7', border: '1.5px solid #D97706', borderRadius: 8 }}>
              <AlertTriangle size={15} color="#D97706" />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#92400E', flex: 1 }}>Log 0 kcal?</span>
              <button type="submit" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#92400E', background: '#FDE68A', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '5px 10px', borderRadius: 6 }}>
                Confirm
              </button>
            </div>
          )}
        </div>

        <button type="button" onClick={() => setShowMacros(value => !value)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: 'var(--accent)', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, minHeight: 44 }}>
          <ChevronDown size={16} style={{ transform: showMacros ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          {showMacros ? 'Hide' : 'Add'} macros
        </button>

        {showMacros && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {(['protein', 'carbs', 'fat'] as const).map(macro => (
              <div key={macro}>
                <label className="label-caps" style={{ display: 'block', marginBottom: 8, textTransform: 'capitalize' }}>{macro}</label>
                <input className="input" type="number" placeholder="0" value={form[macro]} onChange={event => set(macro, event.target.value)} style={{ borderRadius: 8, fontFamily: 'var(--font-mono)' }} />
              </div>
            ))}
          </div>
        )}

        {!zeroCalWarning && (
          <button type="submit" className="btn-primary" disabled={submitting} style={{ borderRadius: 8, marginTop: 8, opacity: submitting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {submitting && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {submitting ? 'Saving' : isEditing ? 'Save changes' : 'Log food'}
          </button>
        )}
      </form>

      <AIErrorModal error={aiError} onClose={() => setAiError(null)} />
    </div>
  );
}
