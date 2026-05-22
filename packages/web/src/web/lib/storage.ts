// Typed localStorage helpers for Nourish

export interface NourishUser {
  name: string;
  age: number;
  sex: 'male' | 'female';
  heightCm: number;
  weightKg: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal: 'lose' | 'maintain' | 'gain';
  calorieGoal: number;
  waterGoalLiters: number;
  metricSystem: boolean;
  macroTargets: { protein: number; carbs: number; fat: number };
  manualCalorieOverride: boolean;
  notifications: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
    hydration: boolean;
  };
  darkMode?: boolean;
}

export interface FoodEntry {
  id: string;
  name: string;
  description?: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
  timestamp: number;
  imageBase64?: string;
}

export interface DayLog {
  water: number;
  foods: FoodEntry[];
  weight?: number;
}

export type NourishLogs = Record<string, DayLog>;

// ── Habits ────────────────────────────────────────────────────────────────────

export type HabitColor =
  | '#F97316' | '#EAB308' | '#22C55E' | '#14B8A6' | '#3B82F6'
  | '#8B5CF6' | '#EC4899' | '#EF4444' | '#C1604F' | '#6B7280';

export interface Habit {
  id: string;
  name: string;
  description?: string;
  color: HabitColor;
  emoji: string;
  createdAt: string; // YYYY-MM-DD — grid starts from this date
}

// completions: { [habitId]: Set<YYYY-MM-DD> } — days marked DONE
// A day is auto-done unless manually un-marked
export type HabitCompletions = Record<string, string[]>; // habitId → array of FAILED dates

export interface HabitsData {
  habits: Habit[];
  // failedDates[habitId] = ['2025-01-03', ...] — days user explicitly unchecked
  failedDates: HabitCompletions;
}

const HABITS_KEY = 'nourish_habits';

export function getHabitsData(): HabitsData {
  try {
    const raw = localStorage.getItem(HABITS_KEY);
    return raw ? (JSON.parse(raw) as HabitsData) : { habits: [], failedDates: {} };
  } catch {
    return { habits: [], failedDates: {} };
  }
}

export function saveHabitsData(data: HabitsData): void {
  localStorage.setItem(HABITS_KEY, JSON.stringify(data));
}

// Keys
const KEYS = {
  onboarded: 'nourish_onboarded',
  user: 'nourish_user',
  logs: 'nourish_logs',
  apikey: 'nourish_apikey',
} as const;

// Onboarded
export function isOnboarded(): boolean {
  return localStorage.getItem(KEYS.onboarded) === 'true';
}
export function setOnboarded(): void {
  localStorage.setItem(KEYS.onboarded, 'true');
}

// User
export function getUser(): NourishUser | null {
  try {
    const raw = localStorage.getItem(KEYS.user);
    if (!raw) return null;
    const u = JSON.parse(raw) as NourishUser;
    if (u.manualCalorieOverride === undefined) u.manualCalorieOverride = false;
    if (!u.notifications) u.notifications = { breakfast: false, lunch: false, dinner: false, hydration: false };
    if (u.darkMode === undefined) u.darkMode = false;
    return u;
  } catch { return null; }
}
export function saveUser(user: NourishUser): void {
  localStorage.setItem(KEYS.user, JSON.stringify(user));
}

// Logs
export function getLogs(): NourishLogs {
  try {
    const raw = localStorage.getItem(KEYS.logs);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
export function saveLogs(logs: NourishLogs): void {
  localStorage.setItem(KEYS.logs, JSON.stringify(logs));
}
export function getDayLog(date: string): DayLog {
  const logs = getLogs();
  return logs[date] ?? { water: 0, foods: [] };
}
export function saveDayLog(date: string, log: DayLog): void {
  const logs = getLogs();
  logs[date] = log;
  saveLogs(logs);
}

// AI config
export type AIProvider = 'openai' | 'anthropic' | 'gemini';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

const AI_CONFIG_KEY = 'nourish_ai_config';

export function getAIConfig(): AIConfig | null {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    return raw ? (JSON.parse(raw) as AIConfig) : null;
  } catch { return null; }
}
export function saveAIConfig(config: AIConfig): void {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}
export function clearAIConfig(): void {
  localStorage.removeItem(AI_CONFIG_KEY);
}

export function getApiKey(): string {
  return getAIConfig()?.apiKey || localStorage.getItem('nourish_apikey') || '';
}
export function saveApiKey(key: string): void {
  const cfg = getAIConfig();
  if (cfg) {
    saveAIConfig({ ...cfg, apiKey: key });
  } else if (key) {
    localStorage.setItem('nourish_apikey', key);
  } else {
    localStorage.removeItem('nourish_apikey');
  }
}

// Reset
export function clearAll(): void {
  localStorage.removeItem(KEYS.onboarded);
  localStorage.removeItem(KEYS.user);
  localStorage.removeItem(KEYS.logs);
}

// Dark mode helper — applies data-theme to <html> immediately
export function applyDarkMode(dark: boolean): void {
  if (dark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}
