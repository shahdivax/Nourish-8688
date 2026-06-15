import React, { useEffect, useRef, useState } from 'react';
import { Cpu, Download, Eye, EyeOff, Moon, RefreshCw, RotateCcw, Scale, Trash2, Upload, User, Zap } from 'lucide-react';
import { AIErrorModal, parseAIError } from '../components/AIErrorModal';
import type { AIErrorInfo } from '../components/AIErrorModal';
import { BottomSheet } from '../components/BottomSheet';
import { fetchModels, testConnection } from '../lib/aiProvider';
import {
  applyDarkMode,
  clearAIConfig,
  getAIConfig,
  saveAIConfig,
  type AIProvider,
  type FoodEntry,
  type NourishLogs,
  type NourishUser,
} from '../lib/storage';
import {
  calculateBaseCalories,
  calculateGoalCaloriesTotal,
  isProfileComplete,
} from '../lib/calculations';

interface SettingsPageProps {
  user: NourishUser | null;
  currentDate: string;
  onUpdateUser: (u: NourishUser) => void;
  onExportCSV: () => void;
  onImportLogs: (logs: NourishLogs) => void;
  onClearToday: () => void;
  onResetAll: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onLogWeight: (w: number) => void;
}

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
};

const PROVIDER_KEY_HINTS: Record<AIProvider, string> = {
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  gemini: 'AIzaSy...',
};

function defaultUser(): NourishUser {
  return {
    name: '',
    age: 0,
    sex: 'male',
    heightCm: 0,
    weightKg: 0,
    goalWeightKg: 0,
    activityLevel: 'sedentary',
    goal: 'lose',
    calorieGoal: 0,
    waterGoalLiters: 2.5,
    metricSystem: true,
    macroTargets: { protein: 0, carbs: 0, fat: 0 },
    manualCalorieOverride: false,
    notifications: { breakfast: false, lunch: false, dinner: false, hydration: false },
    darkMode: false,
  };
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{ width: 44, height: 26, borderRadius: 13, background: checked ? 'var(--accent)' : 'var(--border)', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
      aria-label={checked ? 'Disable' : 'Enable'}
    >
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: checked ? 21 : 3, transition: 'left 0.2s ease' }} />
    </button>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="label-caps" style={{ padding: '0 4px', marginBottom: 8 }}>{label}</div>
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 8 }}>{children}</div>
    </div>
  );
}

function Row({ label, value, icon, onTap, right, danger, last }: {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  onTap?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  last?: boolean;
}) {
  const content = (
    <>
      {icon && <div style={{ color: danger ? '#E11D48' : 'var(--accent)', display: 'flex', flexShrink: 0 }}>{icon}</div>}
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: danger ? '#E11D48' : 'var(--text)', flex: 1, fontWeight: 600 }}>{label}</span>
      {right || (value && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>)}
    </>
  );
  const style: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    background: 'none',
    border: 'none',
    borderBottom: last ? 'none' : '1px solid var(--border)',
    cursor: onTap ? 'pointer' : 'default',
    textAlign: 'left',
    minHeight: 54,
  };
  return onTap ? <button type="button" onClick={onTap} style={style}>{content}</button> : <div style={style}>{content}</div>;
}

function AIConfigSheet({ open, onClose, onToast }: {
  open: boolean;
  onClose: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [provider, setProvider] = useState<AIProvider>(() => getAIConfig()?.provider || 'openai');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [aiError, setAiError] = useState<AIErrorInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    const cfg = getAIConfig();
    setProvider(cfg?.provider || 'openai');
    setApiKey(cfg?.apiKey || '');
    setSelectedModel(cfg?.model || '');
    setModels([]);
    setTestResult(null);
  }, [open]);

  const handleFetchModels = async () => {
    if (!apiKey.trim()) { onToast('Enter your API key first', 'error'); return; }
    setFetchingModels(true);
    try {
      const list = await fetchModels(provider, apiKey.trim());
      setModels(list);
      if (list.length > 0 && !selectedModel) setSelectedModel(list[0]);
      onToast(`Loaded ${list.length} models`);
    } catch (err) {
      setAiError(parseAIError(err, provider));
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTest = async () => {
    if (!apiKey.trim() || !selectedModel) { onToast('Configure API key and model first', 'error'); return; }
    setTesting(true);
    try {
      const result = await testConnection(provider, apiKey.trim(), selectedModel);
      setTestResult(result);
      if (result.ok) onToast('Connection successful');
      else setAiError({ title: 'Connection failed', message: result.message.slice(0, 200), detail: result.message, provider });
    } catch (err) {
      setAiError(parseAIError(err, provider));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const key = apiKey.trim();
    if (!key || !selectedModel) { onToast('API key and model are required', 'error'); return; }
    saveAIConfig({ provider, apiKey: key, model: selectedModel });
    onToast('AI config saved');
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="AI Model Config">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Provider</label>
          <div className="segmented">
            {(['openai', 'anthropic', 'gemini'] as AIProvider[]).map(option => (
              <button key={option} className={provider === option ? 'active' : ''} onClick={() => { setProvider(option); setSelectedModel(''); setModels([]); }}>
                {PROVIDER_LABELS[option]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>API key</label>
          <div style={{ position: 'relative' }}>
            <input className="input" type={showKey ? 'text' : 'password'} placeholder={PROVIDER_KEY_HINTS[provider]} value={apiKey} onChange={event => setApiKey(event.target.value)} style={{ borderRadius: 8, paddingRight: 50, fontFamily: 'var(--font-mono)', fontSize: 13 }} />
            <button type="button" onClick={() => setShowKey(value => !value)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <button type="button" onClick={handleFetchModels} disabled={fetchingModels || !apiKey.trim()} className="btn-ghost" style={{ borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: apiKey.trim() ? 1 : 0.5 }}>
          <RefreshCw size={14} style={{ animation: fetchingModels ? 'spin 0.8s linear infinite' : 'none' }} />
          {fetchingModels ? 'Loading models' : 'Fetch models'}
        </button>
        {(models.length > 0 || selectedModel) && (
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Model</label>
            <select className="input" value={selectedModel} onChange={event => setSelectedModel(event.target.value)} style={{ borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              {selectedModel && models.length === 0 && <option value={selectedModel}>{selectedModel}</option>}
              {models.map(model => <option key={model} value={model}>{model}</option>)}
            </select>
          </div>
        )}
        {selectedModel && (
          <button type="button" onClick={handleTest} disabled={testing} className="btn-ghost" style={{ borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Zap size={14} style={{ animation: testing ? 'spin 0.8s linear infinite' : 'none' }} />
            {testing ? 'Testing' : testResult ? testResult.message : 'Test connection'}
          </button>
        )}
        {getAIConfig() && (
          <button type="button" onClick={() => { clearAIConfig(); onToast('AI config cleared'); onClose(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, color: '#E11D48', textAlign: 'left' }}>
            Remove saved config
          </button>
        )}
        <button type="button" className="btn-primary" onClick={handleSave} style={{ borderRadius: 8 }}>Save configuration</button>
      </div>
      <AIErrorModal error={aiError} onClose={() => setAiError(null)} />
    </BottomSheet>
  );
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export default function SettingsPage({
  user,
  currentDate,
  onUpdateUser,
  onExportCSV,
  onImportLogs,
  onClearToday,
  onResetAll,
  onToast,
  onLogWeight,
}: SettingsPageProps) {
  const [profileSheet, setProfileSheet] = useState(false);
  const [aiSheet, setAiSheet] = useState(false);
  const [resetSheet, setResetSheet] = useState(false);
  const [clearSheet, setClearSheet] = useState(false);
  const [draft, setDraft] = useState<NourishUser>(() => ({ ...defaultUser(), ...(user ?? {}) }));
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft({ ...defaultUser(), ...(user ?? {}) });
  }, [user]);

  const completeDraft = isProfileComplete(draft);
  const bmrPreview = completeDraft ? calculateBaseCalories(draft) : null;
  const totalDebt = completeDraft ? calculateGoalCaloriesTotal(draft.weightKg, draft.goalWeightKg) : 0;
  const kgToLose = completeDraft ? Math.max(draft.weightKg - draft.goalWeightKg, 0) : 0;
  const aiConfig = getAIConfig();
  const aiConfigSummary = aiConfig ? `${PROVIDER_LABELS[aiConfig.provider]} · ${aiConfig.model.split('/').pop()}` : 'Not configured';

  const saveProfile = () => {
    if (!isProfileComplete(draft)) {
      onToast('Fill weight, goal weight, height, age, and sex', 'error');
      return;
    }
    const { actualBaseCalories } = calculateBaseCalories(draft);
    onUpdateUser({
      ...draft,
      goal: 'lose',
      calorieGoal: actualBaseCalories,
      macroTargets: {
        protein: Math.round(actualBaseCalories * 0.3 / 4),
        carbs: Math.round(actualBaseCalories * 0.4 / 4),
        fat: Math.round(actualBaseCalories * 0.3 / 9),
      },
      manualCalorieOverride: false,
      metricSystem: true,
      notifications: draft.notifications || defaultUser().notifications,
    });
    onLogWeight(draft.weightKg);
    setProfileSheet(false);
    onToast('Profile saved');
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length < 2) { onToast('Empty CSV', 'error'); return; }
        const headers = lines[0].split(',').map(header => header.replace(/^"|"$/g, '').toLowerCase().trim());
        const col = (name: string) => headers.findIndex(header => header.includes(name));
        const iDate = col('date');
        const iMeal = col('mealtype') !== -1 ? col('mealtype') : col('meal');
        const iName = col('foodname') !== -1 ? col('foodname') : col('food') !== -1 ? col('food') : col('name');
        const iDesc = col('desc');
        const iQty = col('qty') !== -1 ? col('qty') : col('quantity');
        const iUnit = col('unit');
        const iCals = col('cal');
        const iProt = col('protein');
        const iCarbs = col('carb');
        const iFat = col('fat');
        const entries: FoodEntry[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          const date = cols[iDate]?.trim();
          const name = cols[iName]?.trim();
          if (!date || !name) continue;
          const mealRaw = (cols[iMeal] || 'snacks').toLowerCase().trim();
          const meal = (['breakfast', 'lunch', 'dinner', 'snacks'].includes(mealRaw) ? mealRaw : 'snacks') as FoodEntry['mealType'];
          entries.push({
            id: crypto.randomUUID(),
            name,
            description: iDesc !== -1 ? (cols[iDesc] || undefined) : undefined,
            mealType: meal,
            quantity: parseFloat(cols[iQty]) || 1,
            unit: cols[iUnit]?.trim() || 'g',
            calories: parseInt(cols[iCals]) || 0,
            protein: parseFloat(cols[iProt]) || 0,
            carbs: parseFloat(cols[iCarbs]) || 0,
            fat: parseFloat(cols[iFat]) || 0,
            date,
            timestamp: Date.now() + i,
          });
        }
        if (entries.length === 0) { onToast('No valid entries found', 'error'); return; }
        const incoming: NourishLogs = {};
        entries.forEach(entry => {
          if (!incoming[entry.date]) incoming[entry.date] = { water: 0, foods: [] };
          incoming[entry.date].foods.push(entry);
        });
        onImportLogs(incoming);
        onToast(`Imported ${entries.length} entries`);
      } catch {
        onToast('Failed to parse CSV', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ padding: '0 0 80px', maxWidth: 430, margin: '0 auto', minHeight: '100vh' }}>
      <div style={{ padding: '52px 20px 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--text)', margin: 0 }}>Settings</h1>
      </div>

      <div style={{ padding: '0 20px' }}>
        <Section label="Calorie debt setup">
          <Row
            label={isProfileComplete(user) ? 'Edit profile' : 'Complete profile'}
            icon={<User size={16} />}
            value={isProfileComplete(user) ? `${user.weightKg}kg to ${user.goalWeightKg}kg` : 'Required'}
            onTap={() => { setDraft({ ...defaultUser(), ...(user ?? {}) }); setProfileSheet(true); }}
          />
          <Row label="Total to lose" icon={<Scale size={16} />} value={completeDraft ? `${kgToLose.toFixed(1)} kg` : '--'} />
          <Row label="Total calorie debt" icon={<Scale size={16} />} value={completeDraft ? `${totalDebt.toLocaleString()} kcal` : '--'} />
          <Row label="Raw BMR" icon={<Scale size={16} />} value={bmrPreview ? `${bmrPreview.bmr.toLocaleString()} kcal` : '--'} />
          <Row label="Actual base" icon={<Scale size={16} />} value={bmrPreview ? `${bmrPreview.actualBaseCalories.toLocaleString()} kcal` : '--'} last />
        </Section>

        <Section label="AI guess">
          <Row label="Model configuration" icon={<Cpu size={16} />} value={aiConfigSummary} onTap={() => setAiSheet(true)} last />
        </Section>

        <Section label="Appearance">
          <Row
            label="Dark mode"
            icon={<Moon size={16} />}
            right={<Toggle checked={!!user?.darkMode} onChange={(value) => { applyDarkMode(value); onUpdateUser({ ...defaultUser(), ...(user ?? {}), darkMode: value }); }} />}
            last
          />
        </Section>

        <Section label="Data">
          <input
            ref={importRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) handleImportFile(file);
              event.target.value = '';
            }}
          />
          <Row label="Export CSV" icon={<Download size={16} />} onTap={onExportCSV} />
          <Row label="Import CSV" icon={<Upload size={16} />} onTap={() => importRef.current?.click()} />
          <Row label="Clear today's log" icon={<Trash2 size={16} />} onTap={() => setClearSheet(true)} danger />
          <Row label="Reset all data" icon={<RotateCcw size={16} />} onTap={() => setResetSheet(true)} danger last />
        </Section>
      </div>

      <AIConfigSheet open={aiSheet} onClose={() => setAiSheet(false)} onToast={onToast} />

      <BottomSheet open={profileSheet} onClose={() => setProfileSheet(false)} title="Calorie Debt Setup">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Name</label>
            <input className="input" value={draft.name} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} style={{ borderRadius: 8 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Age</label>
              <input className="input" type="number" value={draft.age || ''} onChange={event => setDraft(value => ({ ...value, age: parseInt(event.target.value) || 0 }))} style={{ borderRadius: 8 }} />
            </div>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Sex</label>
              <div className="segmented">
                <button type="button" className={draft.sex === 'male' ? 'active' : ''} onClick={() => setDraft(value => ({ ...value, sex: 'male' }))}>Male</button>
                <button type="button" className={draft.sex === 'female' ? 'active' : ''} onClick={() => setDraft(value => ({ ...value, sex: 'female' }))}>Female</button>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Current weight kg</label>
              <input className="input" type="number" placeholder="93" value={draft.weightKg || ''} onChange={event => setDraft(value => ({ ...value, weightKg: parseFloat(event.target.value) || 0 }))} style={{ borderRadius: 8 }} />
            </div>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Goal weight kg</label>
              <input className="input" type="number" placeholder="70" value={draft.goalWeightKg || ''} onChange={event => setDraft(value => ({ ...value, goalWeightKg: parseFloat(event.target.value) || 0 }))} style={{ borderRadius: 8 }} />
            </div>
          </div>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Height</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input
                className="input"
                type="number"
                placeholder="ft"
                value={draft.heightCm ? Math.floor(Math.round(draft.heightCm / 2.54) / 12) || '' : ''}
                onChange={event => {
                  const ft = parseInt(event.target.value) || 0;
                  const currentIn = Math.round((draft.heightCm || 0) / 2.54) % 12;
                  setDraft(value => ({ ...value, heightCm: Math.round((ft * 12 + currentIn) * 2.54 * 10) / 10 }));
                }}
                style={{ borderRadius: 8 }}
              />
              <input
                className="input"
                type="number"
                placeholder="in"
                value={draft.heightCm ? Math.round(draft.heightCm / 2.54) % 12 || '' : ''}
                onChange={event => {
                  const inches = parseInt(event.target.value) || 0;
                  const currentFt = Math.floor(Math.round((draft.heightCm || 0) / 2.54) / 12);
                  setDraft(value => ({ ...value, heightCm: Math.round((currentFt * 12 + inches) * 2.54 * 10) / 10 }));
                }}
                style={{ borderRadius: 8 }}
              />
            </div>
          </div>
          <div className="card" style={{ borderRadius: 8, padding: 14, background: 'var(--subtle)' }}>
            <div className="label-caps" style={{ marginBottom: 8 }}>Preview</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text)' }}>
              <span>{completeDraft ? `${kgToLose.toFixed(1)} kg` : '--'} to lose</span>
              <span>{completeDraft ? `${totalDebt.toLocaleString()} kcal` : '--'} debt</span>
              <span>{bmrPreview ? `${bmrPreview.bmr.toLocaleString()} BMR` : '-- BMR'}</span>
              <span>{bmrPreview ? `${bmrPreview.actualBaseCalories.toLocaleString()} base` : '-- base'}</span>
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={saveProfile} style={{ borderRadius: 8 }}>Save setup</button>
        </div>
      </BottomSheet>

      <BottomSheet open={clearSheet} onClose={() => setClearSheet(false)} title="Clear Today's Log?">
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Removes all food entries for {currentDate}. This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={() => setClearSheet(false)} style={{ borderRadius: 8 }}>Cancel</button>
          <button className="btn-primary" style={{ background: '#E11D48', borderRadius: 8 }} onClick={() => { onClearToday(); setClearSheet(false); }}>Clear today</button>
        </div>
      </BottomSheet>

      <BottomSheet open={resetSheet} onClose={() => setResetSheet(false)} title="Reset All Data?">
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Permanently deletes your profile and logs. The app will return to the settings-first setup prompt.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={() => setResetSheet(false)} style={{ borderRadius: 8 }}>Cancel</button>
          <button className="btn-primary" style={{ background: '#E11D48', borderRadius: 8 }} onClick={() => { onResetAll(); setResetSheet(false); }}>Reset everything</button>
        </div>
      </BottomSheet>
    </div>
  );
}
