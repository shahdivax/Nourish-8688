import React from 'react';
import { CalorieRing } from '../components/CalorieRing';
import { WaterCard } from '../components/WaterCard';
import { MealsSummary } from '../components/MealsSummary';
import { getGreeting, formatDate } from '../lib/calculations';
import type { NourishUser, DayLog, FoodEntry } from '../lib/storage';

interface HomePageProps {
  user: NourishUser;
  todayLog: DayLog;
  currentDate: string;
  onSetWater: (glasses: number) => void;
  onRemoveFood: (id: string) => void;
  onEditFood: (entry: FoodEntry) => void;
  onLogTap: () => void;
  onDeletedToast?: () => void;
}

export default function HomePage({
  user,
  todayLog,
  currentDate,
  onSetWater,
  onRemoveFood,
  onEditFood,
  onLogTap,
  onDeletedToast,
}: HomePageProps) {
  const greeting = getGreeting();
  const today = formatDate(new Date(currentDate + 'T12:00:00'));

  const consumed = todayLog.foods.reduce((s, f) => s + f.calories, 0);
  const totalProtein = todayLog.foods.reduce((s, f) => s + (f.protein || 0), 0);
  const totalCarbs = todayLog.foods.reduce((s, f) => s + (f.carbs || 0), 0);
  const totalFat = todayLog.foods.reduce((s, f) => s + (f.fat || 0), 0);

  return (
    <div style={{ padding: '0 0 80px', maxWidth: 430, margin: '0 auto', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '52px 20px 24px' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--text)', lineHeight: 1.2 }}>
          Good {greeting}, {user.name}
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          {today}
        </div>
      </div>

      {/* Calorie Ring */}
      <div style={{ padding: '0 20px 16px' }}>
        <div className="card">
          <div className="label-caps" style={{ marginBottom: 20 }}>Today's calories</div>
          <CalorieRing
            consumed={consumed}
            target={user.calorieGoal}
            protein={totalProtein}
            carbs={totalCarbs}
            fat={totalFat}
            proteinTarget={user.macroTargets.protein}
            carbsTarget={user.macroTargets.carbs}
            fatTarget={user.macroTargets.fat}
          />
        </div>
      </div>

      {/* Water Card */}
      <div style={{ padding: '0 20px 16px' }}>
        <WaterCard
          glasses={todayLog.water}
          goal={user.waterGoalLiters}
          onToggle={(glasses) => onSetWater(glasses)}
        />
      </div>

      {/* Meals */}
      <div style={{ padding: '0 20px' }}>
        <div className="label-caps" style={{ marginBottom: 12 }}>Today's meals</div>
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
