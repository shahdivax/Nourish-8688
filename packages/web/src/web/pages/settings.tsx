import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronRight, Download, Upload, Trash2, RotateCcw,
  Bell, User, Target, Info, Cpu, Eye, EyeOff, RefreshCw, Zap, Moon,
} from 'lucide-react';
import { BottomSheet } from '../components/BottomSheet';
import type { NourishUser, NourishLogs, FoodEntry, AIProvider } from '../lib/storage';
import { getAIConfig, saveAIConfig, clearAIConfig, applyDarkMode } from '../lib/storage';
import { calculateCalorieGoal, calculateMacros } from '../lib/calculations';
import { fetchModels, testConnection } from '../lib/aiProvider';
import { AIErrorModal, parseAIError } from '../components/AIErrorModal';
import type { AIErrorInfo } from '../components/AIErrorModal';

// ── Notification scheduler ────────────────────────────────────────────────────

const notifTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function scheduleReminder(key: string, label: string, targetHour: number, targetMin = 0) {
  clearTimeout(notifTimers[key]);
  const now = new Date();
  const next = new Date();
  next.setHours(targetHour, targetMin, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next.getTime() - now.getTime();
  notifTimers[key] = setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification('Nourish', { body: label, icon: '/logo.svg' });
    }
    scheduleReminder(key, label, targetHour, targetMin);
  }, delay);
}

function clearReminder(key: string) {
  clearTimeout(notifTimers[key]);
  delete notifTimers[key];
}

function scheduleWaterReminders(enabled: boolean) {
  [8, 10, 12, 14, 16, 18, 20, 22].forEach((h) => {
    const key = `water_${h}`;
    if (enabled) scheduleReminder(key, 'Time to drink some water! 💧', h, 0);
    else clearReminder(key);
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SettingsPageProps {
  user: NourishUser;
  currentDate: string;
  onUpdateUser: (u: NourishUser) => void;
  onExportCSV: () => void;
  onImportLogs: (logs: NourishLogs) => void;
  onClearToday: () => void;
  onResetAll: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onLogWeight: (w: number) => void;
}

// ── Tiny UI helpers ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 26, borderRadius: 13,
        background: checked ? 'var(--accent)' : 'var(--border)',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s ease', flexShrink: 0,
      }}
      aria-label={checked ? 'Disable' : 'Enable'}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%', background: 'white',
        position: 'absolute', top: 3, left: checked ? 21 : 3, transition: 'left 0.2s ease',
      }} />
    </button>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="label-caps" style={{ padding: '0 4px', marginBottom: 8 }}>{label}</div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function Row({ label, value, icon, onTap, right, danger, last }: {
  label: string; value?: string; icon?: React.ReactNode;
  onTap?: () => void; right?: React.ReactNode; danger?: boolean; last?: boolean;
}) {
  const style: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', background: 'none', border: 'none',
    borderBottom: last ? 'none' : '1px solid var(--border)',
    cursor: onTap ? 'pointer' : 'default', textAlign: 'left', minHeight: 52,
  };
  const content = (
    <>
      {icon && <div style={{ color: danger ? '#E11D48' : 'var(--accent)', display: 'flex', flexShrink: 0 }}>{icon}</div>}
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: danger ? '#E11D48' : 'var(--text)', flex: 1, fontWeight: 500 }}>
        {label}
      </span>
      {right || (value && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)' }}>{value}</span>)}
      {onTap && !right && <ChevronRight size={16} color="var(--text-secondary)" />}
    </>
  );
  if (onTap) {
    return <button type="button" onClick={onTap} style={style}>{content}</button>;
  }
  return <div style={style}>{content}</div>;
}

// ── Provider display names ────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
};

const PROVIDER_KEY_HINTS: Record<AIProvider, string> = {
  openai: 'sk-…',
  anthropic: 'sk-ant-…',
  gemini: 'AIzaSy…',
};

const PROVIDER_DOCS: Record<AIProvider, string> = {
  openai: 'platform.openai.com/api-keys',
  anthropic: 'console.anthropic.com/settings/keys',
  gemini: 'aistudio.google.com/app/apikey',
};

// ── AI Config Sheet ───────────────────────────────────────────────────────────

function AIConfigSheet({
  open,
  onClose,
  onToast,
}: {
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

  // Load existing config when sheet opens
  useEffect(() => {
    if (!open) return;
    const cfg = getAIConfig();
    if (cfg) {
      setProvider(cfg.provider);
      setApiKey(cfg.apiKey);
      setSelectedModel(cfg.model);
    } else {
      setProvider('openai');
      setApiKey('');
      setSelectedModel('');
    }
    setModels([]);
    setTestResult(null);
  }, [open]);

  // Reset model when provider changes
  const handleProviderChange = (p: AIProvider) => {
    setProvider(p);
    setSelectedModel('');
    setModels([]);
    setTestResult(null);
  };

  const handleFetchModels = async () => {
    if (!apiKey.trim()) { onToast('Enter your API key first', 'error'); return; }
    setFetchingModels(true);
    setTestResult(null);
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
    if (!apiKey.trim() || !selectedModel) { onToast('Configure API key + model first', 'error'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(provider, apiKey.trim(), selectedModel);
      setTestResult(result);
      if (result.ok) {
        onToast('Connection successful!', 'success');
      } else {
        // testConnection returns {ok:false, message} for expected errors — show modal
        setAiError({
          title: 'Connection failed',
          message: result.message.length > 200 ? result.message.slice(0, 200) + '…' : result.message,
          detail: result.message,
          provider,
        });
      }
    } catch (err) {
      setAiError(parseAIError(err, provider));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const key = apiKey.trim();
    if (!key) { onToast('API key is required', 'error'); return; }
    if (!selectedModel) { onToast('Select a model first', 'error'); return; }
    saveAIConfig({ provider, apiKey: key, model: selectedModel });
    onToast('AI config saved');
    onClose();
  };

  const handleClear = () => {
    clearAIConfig();
    setApiKey('');
    setModels([]);
    setSelectedModel('');
    setTestResult(null);
    onToast('AI config cleared');
    onClose();
  };

  const existingConfig = getAIConfig();

  return (
    <BottomSheet open={open} onClose={onClose} title="AI Model Config">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Provider picker */}
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Provider</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {(['openai', 'anthropic', 'gemini'] as AIProvider[]).map(p => (
              <button
                key={p}
                onClick={() => handleProviderChange(p)}
                style={{
                  padding: '10px 6px', borderRadius: 10, border: '2px solid',
                  borderColor: provider === p ? 'var(--accent)' : 'var(--border)',
                  background: provider === p ? 'var(--accent)' : 'var(--surface)',
                  color: provider === p ? 'white' : 'var(--text)',
                  fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s ease', textAlign: 'center',
                }}
              >
                {PROVIDER_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>
            API Key
          </label>
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type={showKey ? 'text' : 'password'}
              placeholder={PROVIDER_KEY_HINTS[provider]}
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setTestResult(null); }}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13, paddingRight: 56 }}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey(s => !s)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
              }}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div style={{ marginTop: 4, fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-secondary)' }}>
            Get your key at <span style={{ color: 'var(--accent)' }}>{PROVIDER_DOCS[provider]}</span>
            {' · '}Stored locally only.
          </div>
        </div>

        {/* Fetch models button */}
        <button
          onClick={handleFetchModels}
          disabled={fetchingModels || !apiKey.trim()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '11px 16px', borderRadius: 10,
            border: '1.5px solid var(--border)',
            background: 'var(--surface)', cursor: apiKey.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text)', fontWeight: 500,
            opacity: apiKey.trim() ? 1 : 0.5,
          }}
        >
          <RefreshCw size={14} style={{
            animation: fetchingModels ? 'spin 0.8s linear infinite' : 'none',
          }} />
          {fetchingModels ? 'Loading models…' : 'Fetch Available Models'}
        </button>

        {/* Model picker — only shown after fetching or if model already set */}
        {(models.length > 0 || selectedModel) && (
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Model</label>
            <select
              className="input"
              value={selectedModel}
              onChange={e => { setSelectedModel(e.target.value); setTestResult(null); }}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
            >
              {models.length === 0 && selectedModel && (
                <option value={selectedModel}>{selectedModel}</option>
              )}
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {/* Test connection */}
        {selectedModel && (
          <button
            onClick={handleTest}
            disabled={testing}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 16px', borderRadius: 10,
              border: '1.5px solid var(--border)',
              background: testResult?.ok ? '#DCFCE7' : testResult ? '#FEE2E2' : 'var(--surface)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: 14,
              color: testResult?.ok ? '#166534' : testResult ? '#991B1B' : 'var(--text)',
              fontWeight: 500,
              transition: 'all 0.2s ease',
            }}
          >
            <Zap size={14} style={{ animation: testing ? 'spin 0.8s linear infinite' : 'none' }} />
            {testing ? 'Testing…' : testResult ? testResult.message : 'Test Connection'}
          </button>
        )}

        {/* Clear existing config */}
        {existingConfig && (
          <button
            onClick={handleClear}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: 13, color: '#E11D48',
              padding: '4px 0', textAlign: 'left',
            }}
          >
            Remove saved config
          </button>
        )}

        <button
          className="btn-primary"
          onClick={handleSave}
          style={{ marginTop: 4 }}
        >
          Save Configuration
        </button>
      </div>
      <AIErrorModal error={aiError} onClose={() => setAiError(null)} />
    </BottomSheet>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────────

export default function SettingsPage({
  user, currentDate,
  onUpdateUser, onExportCSV, onImportLogs,
  onClearToday, onResetAll, onToast, onLogWeight,
}: SettingsPageProps) {
  const [editSheet, setEditSheet] = useState<'profile' | 'targets' | null>(null);
  const [aiSheet, setAiSheet] = useState(false);
  const [resetSheet, setResetSheet] = useState(false);
  const [clearSheet, setClearSheet] = useState(false);
  const [weightSheet, setWeightSheet] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const [editValues, setEditValues] = useState<NourishUser>({ ...user });

  useEffect(() => { setEditValues({ ...user }); }, [user]);

  const bmrBasedPreview = calculateCalorieGoal(
    editValues.weightKg, editValues.heightCm, editValues.age,
    editValues.sex, editValues.activityLevel, editValues.goal,
  );

  const saveProfile = () => {
    const newCal = user.manualCalorieOverride
      ? user.calorieGoal
      : calculateCalorieGoal(editValues.weightKg, editValues.heightCm, editValues.age, editValues.sex, editValues.activityLevel, editValues.goal);
    const macros = calculateMacros(newCal, editValues.goal);
    onUpdateUser({ ...editValues, calorieGoal: newCal, macroTargets: macros });
    setEditSheet(null);
    onToast('Profile saved');
  };

  const saveTargets = () => {
    const macros = calculateMacros(editValues.calorieGoal, editValues.goal);
    onUpdateUser({ ...editValues, macroTargets: macros });
    setEditSheet(null);
    onToast('Targets saved');
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) { onToast('Empty CSV', 'error'); return; }
        const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').toLowerCase().trim());
        const col = (name: string) => headers.findIndex(h => h.includes(name));
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
          const meal = (['breakfast', 'lunch', 'dinner', 'snacks'].includes(mealRaw)
            ? mealRaw : 'snacks') as FoodEntry['mealType'];
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
        entries.forEach(e => {
          if (!incoming[e.date]) incoming[e.date] = { water: 0, foods: [] };
          incoming[e.date].foods.push(e);
        });
        onImportLogs(incoming);
        onToast(`Imported ${entries.length} entries`);
      } catch {
        onToast('Failed to parse CSV', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleNotifToggle = async (key: keyof NourishUser['notifications'], val: boolean) => {
    if (val && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { onToast('Notification permission denied', 'error'); return; }
    }
    const newNotifs = { ...user.notifications, [key]: val };
    onUpdateUser({ ...user, notifications: newNotifs });
    const MEAL_TIMES: Record<string, [number, number]> = {
      breakfast: [8, 0], lunch: [12, 0], dinner: [19, 0],
    };
    if (key === 'hydration') {
      scheduleWaterReminders(val);
    } else if (MEAL_TIMES[key]) {
      const [h, m] = MEAL_TIMES[key];
      if (val) scheduleReminder(key, `Time for ${key}! Log your meal in Nourish.`, h, m);
      else clearReminder(key);
    }
  };

  // Hybrid display: kg for weight, ft+in for height
  const weightDisplay = `${user.weightKg} kg`;
  const totalIn = Math.round(user.heightCm / 2.54);
  const hFt = Math.floor(totalIn / 12);
  const hIn = totalIn % 12;

  const notifs = user.notifications || { breakfast: false, lunch: false, dinner: false, hydration: false };

  const aiConfig = getAIConfig();
  const aiConfigSummary = aiConfig
    ? `${PROVIDER_LABELS[aiConfig.provider]} · ${aiConfig.model.split('/').pop()}`
    : 'Not configured';

  return (
    <div style={{ padding: '0 0 80px', maxWidth: 430, margin: '0 auto', minHeight: '100vh' }}>
      <div style={{ padding: '52px 20px 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--text)', margin: 0 }}>Settings</h1>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* Profile */}
        <Section label="Profile">
          <Row label="Edit Profile" icon={<User size={16} />} value={`${user.name} · ${user.weightKg}kg · ${hFt}'${hIn}"`} onTap={() => { setEditValues({ ...user }); setEditSheet('profile'); }} />
          <Row label="Log Today's Weight" icon={<Target size={16} />} value={weightDisplay} onTap={() => setWeightSheet(true)} last />
        </Section>

        {/* Targets */}
        <Section label="Targets">
          <Row label="Calorie & Macro Goals" icon={<Target size={16} />} value={`${user.calorieGoal} kcal`} onTap={() => { setEditValues({ ...user }); setEditSheet('targets'); }} last />
        </Section>

        {/* AI */}
        <Section label="AI Scan">
          <Row
            label="Model Configuration"
            icon={<Cpu size={16} />}
            value={aiConfigSummary}
            onTap={() => setAiSheet(true)}
            last
          />
        </Section>

        {/* Notifications */}
        <Section label="Notifications">
          {([
            { key: 'breakfast' as const, label: 'Breakfast reminder (8 am)' },
            { key: 'lunch' as const, label: 'Lunch reminder (12 pm)' },
            { key: 'dinner' as const, label: 'Dinner reminder (7 pm)' },
            { key: 'hydration' as const, label: 'Hydration reminders (every 2h)' },
          ]).map(({ key, label }, idx, arr) => (
            <Row
              key={key}
              label={label}
              icon={<Bell size={16} />}
              right={<Toggle checked={notifs[key]} onChange={(v) => handleNotifToggle(key, v)} />}
              last={idx === arr.length - 1}
            />
          ))}
        </Section>

        {/* Appearance */}
        <Section label="Appearance">
          <Row
            label="Dark Mode"
            icon={<Moon size={16} />}
            right={
              <Toggle
                checked={!!user.darkMode}
                onChange={(v) => {
                  applyDarkMode(v);
                  onUpdateUser({ ...user, darkMode: v });
                }}
              />
            }
            last
          />
        </Section>

        {/* Data */}
        <Section label="Data">
          <input
            ref={importRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = '';
            }}
          />
          <Row label="Export CSV" icon={<Download size={16} />} onTap={onExportCSV} />
          <Row label="Import CSV" icon={<Upload size={16} />} onTap={() => importRef.current?.click()} />
          <Row label="Clear Today's Log" icon={<Trash2 size={16} />} onTap={() => setClearSheet(true)} danger />
          <Row label="Reset All Data" icon={<RotateCcw size={16} />} onTap={() => setResetSheet(true)} danger last />
        </Section>

        {/* About */}
        <Section label="About">
          <Row label="Nourish" icon={<Info size={16} />} value="v2.0.0" last />
        </Section>

        {/* Created by */}
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
          padding: '4px 0 24px',
        }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)' }}>
            Made with ♥ by
          </span>
          <a
            href="https://x.com/divax_shah_"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
              color: 'var(--accent)', textDecoration: 'none',
            }}
          >
            @divax_shah_
          </a>
        </div>
      </div>

      {/* AI Config Sheet */}
      <AIConfigSheet open={aiSheet} onClose={() => setAiSheet(false)} onToast={onToast} />

      {/* Edit Profile Sheet */}
      <BottomSheet open={editSheet === 'profile'} onClose={() => setEditSheet(null)} title="Edit Profile">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Name</label>
            <input className="input" value={editValues.name} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} />
          </div>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Age</label>
            <input className="input" type="number" value={editValues.age || ''} onChange={e => setEditValues(v => ({ ...v, age: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Sex</label>
            <div className="segmented">
              <button className={editValues.sex === 'male' ? 'active' : ''} onClick={() => setEditValues(v => ({ ...v, sex: 'male' }))}>Male</button>
              <button className={editValues.sex === 'female' ? 'active' : ''} onClick={() => setEditValues(v => ({ ...v, sex: 'female' }))}>Female</button>
            </div>
          </div>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Weight (kg)</label>
            <input
              className="input" type="number"
              placeholder="e.g. 70"
              value={editValues.weightKg || ''}
              onChange={e => setEditValues(v => ({ ...v, weightKg: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Height</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  className="input" type="number"
                  placeholder="5"
                  value={Math.floor(Math.round(editValues.heightCm / 2.54) / 12) || ''}
                  onChange={e => {
                    const ft = parseInt(e.target.value) || 0;
                    const curIn = Math.round(editValues.heightCm / 2.54) % 12;
                    setEditValues(v => ({ ...v, heightCm: Math.round((ft * 12 + curIn) * 2.54 * 10) / 10 }));
                  }}
                  style={{ paddingRight: 32 }}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)', pointerEvents: 'none' }}>ft</span>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  className="input" type="number"
                  placeholder="10"
                  value={Math.round(editValues.heightCm / 2.54) % 12 || ''}
                  onChange={e => {
                    const inches = parseInt(e.target.value) || 0;
                    const curFt = Math.floor(Math.round(editValues.heightCm / 2.54) / 12);
                    setEditValues(v => ({ ...v, heightCm: Math.round((curFt * 12 + inches) * 2.54 * 10) / 10 }));
                  }}
                  style={{ paddingRight: 32 }}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)', pointerEvents: 'none' }}>in</span>
              </div>
            </div>
          </div>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Activity Level</label>
            <select className="input" value={editValues.activityLevel} onChange={e => setEditValues(v => ({ ...v, activityLevel: e.target.value as NourishUser['activityLevel'] }))}>
              <option value="sedentary">Sedentary (little/no exercise)</option>
              <option value="light">Light (1–3 days/week)</option>
              <option value="moderate">Moderate (3–5 days/week)</option>
              <option value="active">Active (6–7 days/week)</option>
              <option value="very_active">Very Active (hard exercise daily)</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 8, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)' }}>
          {user.manualCalorieOverride ? "Your calorie goal is manually overridden — won't auto-recalculate." : 'Saving will recalculate your calorie goal.'}
        </div>
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={saveProfile}>Save Changes</button>
      </BottomSheet>

      {/* Edit Targets Sheet */}
      <BottomSheet open={editSheet === 'targets'} onClose={() => setEditSheet(null)} title="Edit Targets">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Goal</label>
            <div className="segmented">
              {(['lose', 'maintain', 'gain'] as const).map(g => (
                <button
                  key={g}
                  className={editValues.goal === g ? 'active' : ''}
                  onClick={() => {
                    const newCals = calculateCalorieGoal(editValues.weightKg, editValues.heightCm, editValues.age, editValues.sex, editValues.activityLevel, g);
                    setEditValues(v => ({ ...v, goal: g, calorieGoal: newCals, manualCalorieOverride: false }));
                  }}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Activity Level</label>
            <select
              className="input"
              value={editValues.activityLevel}
              onChange={e => {
                const al = e.target.value as NourishUser['activityLevel'];
                const newCals = calculateCalorieGoal(editValues.weightKg, editValues.heightCm, editValues.age, editValues.sex, al, editValues.goal);
                setEditValues(v => ({ ...v, activityLevel: al, calorieGoal: newCals, manualCalorieOverride: false }));
              }}
            >
              <option value="sedentary">Sedentary</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="active">Active</option>
              <option value="very_active">Very Active</option>
            </select>
          </div>
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Daily Calorie Target</label>
            <input
              className="input" type="number"
              value={editValues.calorieGoal || ''}
              onChange={e => setEditValues(v => ({ ...v, calorieGoal: parseInt(e.target.value) || 0, manualCalorieOverride: true }))}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 18 }}
            />
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              BMR-based target: {bmrBasedPreview} kcal
              {editValues.manualCalorieOverride && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>· manually overridden</span>}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <label className="label-caps">Water Goal</label>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--accent)' }}>
                {(editValues.waterGoalLiters || 2.5).toFixed(1)}L
              </span>
            </div>
            <input
              type="range" min="1" max="5" step="0.5"
              value={editValues.waterGoalLiters || 2.5}
              onChange={e => setEditValues(v => ({ ...v, waterGoalLiters: parseFloat(e.target.value) }))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>1L</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>5L</span>
            </div>
          </div>
        </div>
        <button className="btn-primary" style={{ marginTop: 20 }} onClick={saveTargets}>Save Targets</button>
      </BottomSheet>

      {/* Weight Sheet */}
      <BottomSheet open={weightSheet} onClose={() => setWeightSheet(false)} title="Log Weight">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Enter weight in kg.
          </p>
          <input
            className="input" type="number"
            placeholder="e.g. 72.5"
            value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 20 }}
          />
          <button
            className="btn-primary"
            onClick={() => {
              const raw = parseFloat(weightInput);
              if (!raw) return;
              const kg = raw;
              onLogWeight(kg);
              onToast('Weight logged!');
              setWeightInput('');
              setWeightSheet(false);
            }}
          >
            Save
          </button>
        </div>
      </BottomSheet>

      {/* Clear today confirm */}
      <BottomSheet open={clearSheet} onClose={() => setClearSheet(false)} title="Clear Today's Log?">
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Removes all food and water entries for today. Can't be undone.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={() => setClearSheet(false)}>Cancel</button>
          <button className="btn-primary" style={{ background: '#E11D48' }} onClick={() => { onClearToday(); setClearSheet(false); }}>
            Clear Today
          </button>
        </div>
      </BottomSheet>

      {/* Reset all confirm */}
      <BottomSheet open={resetSheet} onClose={() => setResetSheet(false)} title="Reset All Data?">
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Permanently deletes your profile, all logs, and settings. You'll re-onboard from scratch.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={() => setResetSheet(false)}>Cancel</button>
          <button className="btn-primary" style={{ background: '#E11D48' }} onClick={() => { onResetAll(); setResetSheet(false); }}>
            Reset Everything
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

// ── CSV line parser ───────────────────────────────────────────────────────────

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
