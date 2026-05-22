import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Minus, Plus } from 'lucide-react';
import type { NourishUser } from '../lib/storage';
import { calculateCalorieGoal, calculateMacros } from '../lib/calculations';

interface OnboardingProps {
  onComplete: (user: NourishUser) => void;
}

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
  { value: 'light', label: 'Light', desc: '1–3 days/week' },
  { value: 'moderate', label: 'Moderate', desc: '3–5 days/week' },
  { value: 'active', label: 'Active', desc: '6–7 days/week' },
  { value: 'very_active', label: 'Very Active', desc: 'Hard exercise daily' },
] as const;

type Draft = {
  name: string;
  age: string;
  sex: 'male' | 'female';
  weightKg: string;
  heightFt: string;   // feet part of height
  heightIn: string;   // inches part of height
  activityLevel: NourishUser['activityLevel'];
  goal: NourishUser['goal'];
  calorieGoal: number | null; // null = auto-calculated
  waterGoalLiters: number;
};

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    name: '',
    age: '',
    sex: 'male',
    weightKg: '',
    heightFt: '',
    heightIn: '',
    activityLevel: 'moderate',
    goal: 'maintain',
    calorieGoal: null,
    waterGoalLiters: 2.5,
  });

  const up = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }));

  // Hybrid: weight in kg, height in feet+inches → always store as cm
  const weightKg = parseFloat(draft.weightKg) || 0;
  const heightCm = Math.round(((parseFloat(draft.heightFt) || 0) * 12 + (parseFloat(draft.heightIn) || 0)) * 2.54 * 10) / 10;
  const age = parseInt(draft.age) || 0;

  const computedCalories = (weightKg && heightCm && age)
    ? calculateCalorieGoal(weightKg, heightCm, age, draft.sex, draft.activityLevel, draft.goal)
    : 2000;

  const calorieGoal = draft.calorieGoal ?? computedCalories;

  const handleComplete = () => {
    const macros = calculateMacros(calorieGoal, draft.goal);
    const user: NourishUser = {
      name: draft.name.trim() || 'there',
      age,
      sex: draft.sex,
      heightCm,
      weightKg,
      activityLevel: draft.activityLevel,
      goal: draft.goal,
      calorieGoal,
      waterGoalLiters: draft.waterGoalLiters,
      metricSystem: true, // always store metric internally
      macroTargets: macros,
      manualCalorieOverride: false,
      notifications: { breakfast: false, lunch: false, dinner: false, hydration: false },
    };
    onComplete(user);
  };

  const steps = [
    <Step0 key="s0" onNext={() => setStep(1)} />,
    <Step1 key="s1" draft={draft} up={up} onNext={() => setStep(2)} onBack={() => setStep(0)} />,
    <Step2 key="s2" draft={draft} up={up} onNext={() => setStep(3)} onBack={() => setStep(1)} />,
    <Step3
      key="s3"
      draft={draft}
      up={up}
      computedCalories={computedCalories}
      calorieGoal={calorieGoal}
      onBack={() => setStep(2)}
      onComplete={handleComplete}
    />,
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 430,
      margin: '0 auto',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {step > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '16px 0 0' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              width: i <= step ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i <= step ? 'var(--accent)' : 'var(--border)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {steps[step]}
      </div>
    </div>
  );
}

// ── Step 0: Welcome ──────────────────────────────────────────────────────────

function Step0({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ padding: '60px 24px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', justifyContent: 'center' }}>
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 24 }}>
        <rect width="72" height="72" rx="18" fill="var(--accent-light)" />
        <line x1="26" y1="18" x2="26" y2="28" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="22" y1="18" x2="22" y2="26" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="30" y1="18" x2="30" y2="26" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M22 26 C22 30 26 32 26 32 L26 54" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="46" cy="42" rx="14" ry="10" stroke="var(--accent)" strokeWidth="2.5" />
        <ellipse cx="46" cy="42" rx="9" ry="6" stroke="var(--accent)" strokeWidth="1.5" opacity="0.5" />
        <line x1="46" y1="28" x2="46" y2="32" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M42 32 C42 29 50 29 50 32 L50 33 L42 33 Z" fill="var(--accent)" />
      </svg>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 42, color: 'var(--text)', margin: '0 0 12px', textAlign: 'center', lineHeight: 1.1 }}>
        Nourish
      </h1>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--text-secondary)', margin: '0 0 48px', textAlign: 'center', fontWeight: 400, fontStyle: 'italic' }}>
        Track what matters.
      </p>
      <button className="btn-primary" onClick={onNext} style={{ maxWidth: 280 }}>
        Get Started
      </button>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 20, textAlign: 'center' }}>
        Takes about 2 minutes to set up
      </p>
    </div>
  );
}

// ── Step 1: Name, Age, Sex, Unit ─────────────────────────────────────────────

function Step1({ draft, up, onNext, onBack }: {
  draft: Draft; up: (p: Partial<Draft>) => void; onNext: () => void; onBack: () => void;
}) {
  const valid = draft.name.trim() && draft.age;

  return (
    <div style={{ padding: '24px 24px 40px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 20px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <ChevronLeft size={18} />
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14 }}>Back</span>
      </button>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--text)', margin: '0 0 6px' }}>About you</h2>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 28px' }}>We use this to personalise your plan</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Your name</label>
          <input className="input" placeholder="e.g. Alex" value={draft.name} onChange={e => up({ name: e.target.value })} />
        </div>
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Age</label>
          <input className="input" type="number" placeholder="e.g. 28" value={draft.age} onChange={e => up({ age: e.target.value })} />
        </div>
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Sex</label>
          <div className="segmented">
            <button className={draft.sex === 'male' ? 'active' : ''} onClick={() => up({ sex: 'male' })}>Male</button>
            <button className={draft.sex === 'female' ? 'active' : ''} onClick={() => up({ sex: 'female' })}>Female</button>
          </div>
        </div>

      </div>
      <div style={{ marginTop: 32 }}>
        <button className="btn-primary" onClick={onNext} disabled={!valid} style={{ opacity: valid ? 1 : 0.5 }}>
          Continue <ChevronRight size={16} style={{ display: 'inline', marginLeft: 4 }} />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Weight, Height, Activity ─────────────────────────────────────────

function Step2({ draft, up, onNext, onBack }: {
  draft: Draft; up: (p: Partial<Draft>) => void; onNext: () => void; onBack: () => void;
}) {
  const valid = draft.weightKg && draft.heightFt;

  return (
    <div style={{ padding: '24px 24px 40px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 20px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <ChevronLeft size={18} />
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14 }}>Back</span>
      </button>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--text)', margin: '0 0 6px' }}>Body stats</h2>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 28px' }}>Used to calculate your calorie target</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Weight (kg)</label>
          <input
            className="input" type="number"
            placeholder="e.g. 70"
            value={draft.weightKg}
            onChange={e => up({ weightKg: e.target.value })}
          />
        </div>
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Height</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                className="input" type="number"
                placeholder="5"
                value={draft.heightFt}
                onChange={e => up({ heightFt: e.target.value })}
                style={{ paddingRight: 32 }}
              />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)', pointerEvents: 'none' }}>ft</span>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                className="input" type="number"
                placeholder="10"
                value={draft.heightIn}
                onChange={e => up({ heightIn: e.target.value })}
                style={{ paddingRight: 32 }}
              />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)', pointerEvents: 'none' }}>in</span>
            </div>
          </div>
        </div>
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Activity level</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ACTIVITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => up({ activityLevel: opt.value, calorieGoal: null })}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '12px 16px',
                  border: `2px solid ${draft.activityLevel === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 12,
                  background: draft.activityLevel === opt.value ? 'var(--accent-light)' : 'var(--card)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease', minHeight: 48,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{opt.label}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)' }}>{opt.desc}</div>
                </div>
                {draft.activityLevel === opt.value && (
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 32 }}>
        <button className="btn-primary" onClick={onNext} disabled={!valid} style={{ opacity: valid ? 1 : 0.5 }}>
          Continue <ChevronRight size={16} style={{ display: 'inline', marginLeft: 4 }} />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Goal + calorie + water ───────────────────────────────────────────

function Step3({ draft, up, computedCalories, calorieGoal, onBack, onComplete }: {
  draft: Draft;
  up: (p: Partial<Draft>) => void;
  computedCalories: number;
  calorieGoal: number;
  onBack: () => void;
  onComplete: () => void;
}) {
  const goals = [
    { id: 'lose' as const, icon: '↓', label: 'Lose Weight', desc: '−500 kcal/day deficit' },
    { id: 'maintain' as const, icon: '→', label: 'Maintain', desc: 'Stay at current weight' },
    { id: 'gain' as const, icon: '↑', label: 'Gain Weight', desc: '+500 kcal/day surplus' },
  ];

  const handleGoalSelect = (goal: NourishUser['goal']) => {
    // Recalculate from scratch when goal changes
    up({ goal, calorieGoal: null });
  };

  const waterGoal = draft.waterGoalLiters;

  return (
    <div style={{ padding: '24px 24px 40px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 20px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <ChevronLeft size={18} />
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14 }}>Back</span>
      </button>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--text)', margin: '0 0 6px' }}>Your goal</h2>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px' }}>We'll set your daily calorie target</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {goals.map(g => (
          <button
            key={g.id}
            onClick={() => handleGoalSelect(g.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
              border: `2px solid ${draft.goal === g.id ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 16,
              background: draft.goal === g.id ? 'var(--accent-light)' : 'var(--card)',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease', minHeight: 72,
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: draft.goal === g.id ? 'var(--accent)' : 'var(--subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-serif)', fontSize: 22,
              color: draft.goal === g.id ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.15s ease', flexShrink: 0,
            }}>
              {g.icon}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{g.label}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)' }}>{g.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Calorie target */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="label-caps" style={{ marginBottom: 12 }}>Daily calorie target</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => up({ calorieGoal: Math.max(calorieGoal - 50, 800) })}
            style={{ width: 40, height: 40, borderRadius: 10, border: '2px solid var(--border)', background: 'var(--subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Minus size={16} color="var(--text)" />
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <input
              type="number"
              value={calorieGoal}
              onChange={e => up({ calorieGoal: parseInt(e.target.value) || computedCalories })}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 500, color: 'var(--accent)',
                border: 'none', background: 'none', textAlign: 'center', width: '100%', outline: 'none',
              }}
            />
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-secondary)' }}>kcal / day</div>
          </div>
          <button
            onClick={() => up({ calorieGoal: calorieGoal + 50 })}
            style={{ width: 40, height: 40, borderRadius: 10, border: '2px solid var(--border)', background: 'var(--subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Plus size={16} color="var(--text)" />
          </button>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 8 }}>
          Calculated from your stats: {computedCalories} kcal · tap ± to adjust
        </div>
      </div>

      {/* Water goal */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="label-caps">Daily water goal</div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--accent)', fontWeight: 500 }}>
            {waterGoal.toFixed(1)}L
          </span>
        </div>
        <input
          type="range" min="1" max="5" step="0.5"
          value={waterGoal}
          onChange={e => up({ waterGoalLiters: parseFloat(e.target.value) })}
          style={{ width: '100%', height: 4, accentColor: 'var(--accent)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>1L</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>5L</span>
        </div>
      </div>

      <button className="btn-primary" onClick={onComplete}>
        Start tracking
      </button>
    </div>
  );
}
