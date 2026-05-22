import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import type { NourishUser, NourishLogs } from '../lib/storage';
import { dateRange, shortLabel } from '../lib/calculations';

interface InsightsPageProps {
  user: NourishUser;
  logs: NourishLogs;
}

type Range = '7D' | '30D' | '90D';

const ACCENT = '#C1604F';
const MACRO_COLORS = ['#1C1C1E', '#D97706', '#E11D48'];
const tickStyle = { fontFamily: 'var(--font-mono)', fontSize: 10, fill: '#ADADAD' };

function getDays(range: Range): string[] {
  return dateRange(range === '7D' ? 7 : range === '30D' ? 30 : 90);
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div style={{
      height: 180, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      <div style={{ fontSize: 28, opacity: 0.3 }}>📊</div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 220 }}>
        {message}
      </div>
    </div>
  );
}

export default function InsightsPage({ user, logs }: InsightsPageProps) {
  const [range, setRange] = useState<Range>('7D');

  const {
    data, loggedDays, hasMacros, hasWater, weightData,
    avgCalories, avgWater, streak, macroData, tickInterval,
  } = useMemo(() => {
    const days = getDays(range);

    const data = days.map(date => {
      const log = logs[date];
      const calories = log ? log.foods.reduce((s, f) => s + f.calories, 0) : 0;
      const protein = log ? log.foods.reduce((s, f) => s + (f.protein || 0), 0) : 0;
      const carbs = log ? log.foods.reduce((s, f) => s + (f.carbs || 0), 0) : 0;
      const fat = log ? log.foods.reduce((s, f) => s + (f.fat || 0), 0) : 0;
      const water = log?.water || 0;
      const weight = log?.weight ?? null;
      return { date, label: shortLabel(date), calories, protein, carbs, fat, water, weight };
    });

    const loggedDays = data.filter(d => d.calories > 0);
    const hasMacros = loggedDays.some(d => d.protein > 0 || d.carbs > 0 || d.fat > 0);
    const hasWater = loggedDays.some(d => d.water > 0);
    const weightData = data.filter(d => d.weight !== null);

    const avgCalories = loggedDays.length > 0
      ? Math.round(loggedDays.reduce((s, d) => s + d.calories, 0) / loggedDays.length)
      : 0;
    const avgWater = loggedDays.length > 0
      ? (loggedDays.reduce((s, d) => s + d.water, 0) / loggedDays.length).toFixed(1)
      : '0';

    // Streak: consecutive logged days ending today
    let streak = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].calories > 0) streak++;
      else break;
    }

    // Macro totals for pie
    const totalProtein = loggedDays.reduce((s, d) => s + d.protein, 0);
    const totalCarbs = loggedDays.reduce((s, d) => s + d.carbs, 0);
    const totalFat = loggedDays.reduce((s, d) => s + d.fat, 0);
    const macroData = [
      { name: 'Protein', value: totalProtein },
      { name: 'Carbs', value: totalCarbs },
      { name: 'Fat', value: totalFat },
    ];

    const tickInterval = range === '7D' ? 0 : range === '30D' ? 4 : 14;

    return { data, loggedDays, hasMacros, hasWater, weightData, avgCalories, avgWater, streak, macroData, tickInterval };
  }, [logs, range]);

  return (
    <div style={{ padding: '0 0 80px', maxWidth: 430, margin: '0 auto', minHeight: '100vh' }}>
      <div style={{ padding: '52px 20px 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--text)', margin: '0 0 16px' }}>Insights</h1>
        <div className="segmented" style={{ maxWidth: 220 }}>
          {(['7D', '30D', '90D'] as Range[]).map(r => (
            <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 20px' }}>

        {/* Calorie Trend */}
        <div className="card">
          <div className="label-caps" style={{ marginBottom: 14 }}>Calorie Trend</div>
          {loggedDays.length === 0 ? (
            <EmptyChart message="Log some meals to see your calorie trend" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={tickStyle} tickLine={false} axisLine={false} interval={tickInterval} />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ fontFamily: 'var(--font-sans)', fontSize: 12, border: '2px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}
                    labelStyle={{ fontWeight: 600 }}
                    formatter={(v: number) => [`${v} kcal`, 'Calories']}
                  />
                  <ReferenceLine y={user.calorieGoal} stroke={ACCENT} strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Line type="monotone" dataKey="calories" stroke={ACCENT} strokeWidth={2} dot={{ fill: ACCENT, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                Dashed line = goal ({user.calorieGoal} kcal)
              </div>
            </>
          )}
        </div>

        {/* Macro Split */}
        <div className="card">
          <div className="label-caps" style={{ marginBottom: 14 }}>Macro Split</div>
          {!hasMacros ? (
            <EmptyChart message="Add macro data when logging meals to see your split" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={macroData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {macroData.map((_, i) => <Cell key={i} fill={MACRO_COLORS[i]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ fontFamily: 'var(--font-sans)', fontSize: 12, border: '2px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}
                  formatter={(v: number, name: string) => [`${v}g`, name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(v) => <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text)' }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Water Intake */}
        <div className="card">
          <div className="label-caps" style={{ marginBottom: 14 }}>Water Intake</div>
          {!hasWater ? (
            <EmptyChart message="Track your water intake on the home screen" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={tickStyle} tickLine={false} axisLine={false} interval={tickInterval} />
                <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontFamily: 'var(--font-sans)', fontSize: 12, border: '2px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}
                  formatter={(v: number) => [`${v} glasses`, 'Water']}
                />
                <Bar dataKey="water" fill="#93C5FD" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Weight Trend */}
        <div className="card">
          <div className="label-caps" style={{ marginBottom: 14 }}>Weight Trend</div>
          {weightData.length < 2 ? (
            <EmptyChart message="Log your weight in Settings for at least 2 days to see the trend" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weightData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={tickStyle} tickLine={false} axisLine={false} />
                <YAxis tick={tickStyle} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ fontFamily: 'var(--font-sans)', fontSize: 12, border: '2px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}
                  formatter={(v: number) => [`${v} ${user.metricSystem ? 'kg' : 'lbs'}`, 'Weight']}
                />
                <Line type="monotone" dataKey="weight" stroke="#1C1C1E" strokeWidth={2} dot={{ fill: '#1C1C1E', r: 3, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {[
            { label: 'Streak', value: `${streak}d`, icon: '🔥' },
            { label: 'Avg Calories', value: avgCalories > 0 ? `${avgCalories}` : '–', icon: '⚡' },
            { label: 'Avg Water', value: avgWater !== '0' ? `${avgWater}g` : '–', icon: '💧' },
          ].map(stat => (
            <div key={stat.label} className="card" style={{ flex: 1, textAlign: 'center', padding: '14px 8px' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>
                {stat.value}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
