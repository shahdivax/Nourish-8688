import React from 'react';
import { ArrowRight, Scale, Target, TrendingDown } from 'lucide-react';
import { MealsSummary } from '../components/MealsSummary';
import {
  calculateBaseCalories,
  calculateCumulativeDelta,
  calculateDailyCaloriesEaten,
  calculateDailyDelta,
  calculateGoalCaloriesTotal,
  calculateRemainingGoalCalories,
  formatDate,
  getGreeting,
  isProfileComplete,
} from '../lib/calculations';
import type { DayLog, FoodEntry, NourishLogs, NourishUser } from '../lib/storage';

interface HomePageProps {
  user: NourishUser | null;
  logs: NourishLogs;
  todayLog: DayLog;
  currentDate: string;
  onRemoveFood: (id: string) => void;
  onEditFood: (entry: FoodEntry) => void;
  onLogTap: () => void;
  onSettingsTap: () => void;
  onDeletedToast?: () => void;
}

function fmt(value: number): string {
  return Math.round(value).toLocaleString();
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="card" style={{ borderRadius: 8, padding: 14 }}>
      <div className="label-caps" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 24,
        color: tone === 'good' ? '#15803D' : tone === 'bad' ? '#B91C1C' : 'var(--text)',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
    </div>
  );
}

export default function HomePage({
  user,
  logs,
  todayLog,
  currentDate,
  onRemoveFood,
  onEditFood,
  onLogTap,
  onSettingsTap,
  onDeletedToast,
}: HomePageProps) {
  const greeting = getGreeting();
  const today = formatDate(new Date(currentDate + 'T12:00:00'));
  const complete = isProfileComplete(user);

  if (!complete) {
    return (
      <div style={{ padding: '0 20px 80px', maxWidth: 430, margin: '0 auto', minHeight: '100vh' }}>
        <div style={{ padding: '52px 0 22px' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--text)', lineHeight: 1.1 }}>
            Good {greeting}
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            {today}
          </div>
        </div>

        <div className="card" style={{ borderRadius: 8, padding: 20 }}>
          <div style={{ width: 46, height: 46, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Scale size={22} color="var(--accent)" />
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, margin: '0 0 8px', color: 'var(--text)', lineHeight: 1.05 }}>
            Set your numbers first.
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, lineHeight: 1.55, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
            Add your current weight, goal weight, height, age, and sex in Settings. Once saved, this screen becomes your live calorie debt ledger.
          </p>
          <button
            className="btn-primary"
            onClick={onSettingsTap}
            style={{ borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            Open Settings <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  const { bmr, actualBaseCalories } = calculateBaseCalories(user);
  const totalGoal = calculateGoalCaloriesTotal(user.weightKg, user.goalWeightKg);
  const remaining = calculateRemainingGoalCalories(user, logs);
  const eatenToday = calculateDailyCaloriesEaten(todayLog);
  const todayDelta = calculateDailyDelta(actualBaseCalories, todayLog);
  const cumulativeDelta = calculateCumulativeDelta(logs, actualBaseCalories);
  const progress = totalGoal > 0 ? Math.min(Math.max((totalGoal - remaining) / totalGoal, 0), 1) : 1;
  const kgToLose = Math.max(user.weightKg - user.goalWeightKg, 0);

  return (
    <div style={{ padding: '0 0 80px', maxWidth: 430, margin: '0 auto', minHeight: '100vh' }}>
      <div style={{ padding: '52px 20px 22px' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--text)', lineHeight: 1.1 }}>
          Good {greeting}, {user.name || 'there'}
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          {today}
        </div>
      </div>

      <div style={{ padding: '0 20px 16px' }}>
        <div className="card" style={{ borderRadius: 8, padding: 18, background: 'var(--card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div className="label-caps">Remaining to goal</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 38, color: 'var(--text)', lineHeight: 1, marginTop: 8 }}>
                {fmt(remaining)}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                kcal left in the ledger
              </div>
            </div>
            <div style={{ width: 58, height: 58, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={26} color="var(--accent)" />
            </div>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: 'var(--subtle)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--accent)', transition: 'width 400ms ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
            <span>{fmt(Math.max(totalGoal - remaining, 0))} cleared</span>
            <span>{fmt(totalGoal)} total</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Metric label="Current" value={`${user.weightKg} kg`} />
        <Metric label="Goal" value={`${user.goalWeightKg} kg`} />
        <Metric label="To lose" value={`${Number(kgToLose.toFixed(1))} kg`} />
        <Metric label="BMR + 200" value={`${fmt(actualBaseCalories)}`} />
      </div>

      <div style={{ padding: '0 20px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Metric label="Eaten today" value={`${fmt(eatenToday)}`} />
        <Metric
          label="Today delta"
          value={`${todayDelta >= 0 ? '-' : '+'}${fmt(Math.abs(todayDelta))}`}
          tone={todayDelta >= 0 ? 'good' : 'bad'}
        />
        <Metric label="Raw BMR" value={`${fmt(bmr)}`} />
        <Metric
          label="Net ledger"
          value={`${cumulativeDelta >= 0 ? '-' : '+'}${fmt(Math.abs(cumulativeDelta))}`}
          tone={cumulativeDelta >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="label-caps">Today’s food</div>
          <button
            type="button"
            onClick={onLogTap}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Log food
          </button>
        </div>
        <MealsSummary
          foods={todayLog.foods}
          onRemove={onRemoveFood}
          onEdit={onEditFood}
          onLogTap={onLogTap}
          onDeletedToast={onDeletedToast}
        />
      </div>
    </div>
  );
}
