import type { NourishUser } from './storage';

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const;

export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: 'male' | 'female',
): number {
  return sex === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

// Daily target is based on BMR, then adjusted by goal.
export function calculateCalorieGoal(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: 'male' | 'female',
  _activityLevel: keyof typeof ACTIVITY_MULTIPLIERS,
  goal: 'lose' | 'maintain' | 'gain',
): number {
  const bmr = calculateBMR(weightKg, heightCm, age, sex);

  const adj = goal === 'lose' ? -500 : goal === 'gain' ? 500 : 0;
  return Math.round(bmr + adj);
}

export function calculateMacros(
  calories: number,
  goal: 'lose' | 'maintain' | 'gain',
): { protein: number; carbs: number; fat: number } {
  const splits = {
    lose:     { p: 0.35, c: 0.35, f: 0.30 },
    maintain: { p: 0.30, c: 0.40, f: 0.30 },
    gain:     { p: 0.30, c: 0.45, f: 0.25 },
  };
  const { p, c, f } = splits[goal];
  return {
    protein: Math.round((calories * p) / 4),
    carbs:   Math.round((calories * c) / 4),
    fat:     Math.round((calories * f) / 9),
  };
}

export function getGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function dateRange(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().split('T')[0];
  });
}

export function shortLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Convert lbs→kg and inches→cm if user is using imperial
export function toMetric(user: Partial<NourishUser> & { metricSystem?: boolean; weightLbs?: number; heightIn?: number }): { weightKg: number; heightCm: number } {
  if (user.metricSystem !== false) {
    return { weightKg: user.weightKg ?? 70, heightCm: user.heightCm ?? 175 };
  }
  return {
    weightKg: Math.round((user.weightLbs ?? 154) * 0.453592 * 10) / 10,
    heightCm: Math.round((user.heightIn ?? 69) * 2.54 * 10) / 10,
  };
}
