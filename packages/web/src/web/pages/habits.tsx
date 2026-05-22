import React, { useState, useMemo } from 'react';
import { Plus, Trash2, X, Check } from 'lucide-react';
import { BottomSheet } from '../components/BottomSheet';
import type { Habit, HabitColor, HabitsData } from '../lib/storage';

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS: HabitColor[] = [
  '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
  '#C1604F', '#6B7280',
];

const EMOJIS = ['💪', '📚', '🏃', '🧘', '💧', '🥗', '🎯', '✍️', '🎸', '💻', '🌿', '🛌', '🚴', '🧠', '🎨'];

const GRID_DAYS = 105; // 15 weeks

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);
}

function buildGrid(habit: Habit): string[] {
  // Show last GRID_DAYS days ending today
  const today = todayStr();
  const days: string[] = [];
  for (let i = GRID_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  // Only show from habit creation date
  return days.filter(d => d >= habit.createdAt);
}

function getCurrentStreak(habit: Habit, failedDates: Set<string>): number {
  const today = todayStr();
  let streak = 0;
  let d = today;
  while (d >= habit.createdAt) {
    if (failedDates.has(d)) break;
    streak++;
    const prev = new Date(d + 'T12:00:00');
    prev.setDate(prev.getDate() - 1);
    d = prev.toISOString().split('T')[0];
  }
  return streak;
}

function getCompletionRate(habit: Habit, failedDates: Set<string>): number {
  const today = todayStr();
  const total = Math.min(GRID_DAYS, daysBetween(habit.createdAt, today) + 1);
  if (total <= 0) return 100;
  const failed = Array.from(failedDates).filter(d => d >= habit.createdAt && d <= today).length;
  return Math.round(((total - failed) / total) * 100);
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function HabitGrid({
  habit,
  failedDates,
  onToggle,
}: {
  habit: Habit;
  failedDates: Set<string>;
  onToggle: (date: string) => void;
}) {
  const today = todayStr();
  const days = buildGrid(habit);
  const streak = getCurrentStreak(habit, failedDates);
  const rate = getCompletionRate(habit, failedDates);

  // Pad to full weeks
  const firstDow = new Date(days[0] + 'T12:00:00').getDay(); // 0=Sun
  const padded: (string | null)[] = [...Array(firstDow).fill(null), ...days];
  // Chunk into weeks (columns)
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  // Month labels
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = '';
  weeks.forEach((week, wi) => {
    const firstReal = week.find(d => d !== null);
    if (firstReal) {
      const m = new Date(firstReal + 'T12:00:00').toLocaleString('en-US', { month: 'short' });
      if (m !== lastMonth) {
        monthLabels.push({ label: m, col: wi });
        lastMonth = m;
      }
    }
  });

  const CELL = 11;
  const GAP = 2;

  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: 16,
      border: '1.5px solid var(--border)',
      padding: '14px 14px 12px',
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: habit.color + '22',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          {habit.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 700,
            fontSize: 15, color: 'var(--text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {habit.name}
          </div>
          {habit.description && (
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 12,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {habit.description}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: habit.color }}>
              {streak}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-secondary)' }}>streak</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: habit.color }}>
              {rate}%
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-secondary)' }}>done</div>
          </div>
        </div>
      </div>

      {/* Month labels */}
      <div style={{
        display: 'flex', gap: GAP, marginBottom: 3, paddingLeft: 0,
        overflow: 'hidden',
      }}>
        {weeks.map((_, wi) => {
          const ml = monthLabels.find(m => m.col === wi);
          return (
            <div
              key={wi}
              style={{
                width: CELL, flexShrink: 0,
                fontFamily: 'var(--font-mono)', fontSize: 8,
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap', overflow: 'visible',
              }}
            >
              {ml?.label || ''}
            </div>
          );
        })}
      </div>

      {/* Grid: weeks = columns, days of week = rows */}
      <div style={{ display: 'flex', gap: GAP, overflowX: 'auto' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP, flexShrink: 0 }}>
            {week.map((date, di) => {
              if (!date) {
                return <div key={di} style={{ width: CELL, height: CELL }} />;
              }
              const isFuture = date > today;
              const isFailed = failedDates.has(date);
              const isBeforeCreation = date < habit.createdAt;
              const isDone = !isFailed && !isFuture && !isBeforeCreation;
              const isToday = date === today;

              let bg: string;
              if (isBeforeCreation) bg = 'transparent';
              else if (isFuture) bg = 'var(--border)';
              else if (isDone) bg = habit.color;
              else bg = 'var(--border)';

              return (
                <div
                  key={di}
                  className="habit-cell"
                  title={date}
                  onClick={() => !isBeforeCreation && !isFuture && onToggle(date)}
                  style={{
                    width: CELL, height: CELL,
                    background: bg,
                    opacity: isBeforeCreation ? 0 : 1,
                    outline: isToday ? `2px solid ${habit.color}` : 'none',
                    outlineOffset: '1px',
                    cursor: isFuture || isBeforeCreation ? 'default' : 'pointer',
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Create/Edit sheet ─────────────────────────────────────────────────────────

function HabitForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Habit;
  onSave: (h: Omit<Habit, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [color, setColor] = useState<HabitColor>(initial?.color ?? '#22C55E');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '💪');

  const valid = name.trim().length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Emoji picker */}
      <div>
        <div className="label-caps" style={{ marginBottom: 8 }}>Icon</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              style={{
                width: 40, height: 40, borderRadius: 10, fontSize: 20,
                border: emoji === e ? `2px solid ${color}` : '2px solid var(--border)',
                background: emoji === e ? color + '22' : 'var(--subtle)',
                cursor: 'pointer',
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <div className="label-caps" style={{ marginBottom: 6 }}>Habit name</div>
        <input
          className="input"
          placeholder="e.g. Morning run"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={40}
          autoFocus
        />
      </div>

      {/* Description */}
      <div>
        <div className="label-caps" style={{ marginBottom: 6 }}>Description (optional)</div>
        <input
          className="input"
          placeholder="e.g. At least 20 minutes"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          maxLength={80}
        />
      </div>

      {/* Color */}
      <div>
        <div className="label-caps" style={{ marginBottom: 8 }}>Color</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: c,
                border: color === c ? '3px solid var(--text)' : '3px solid transparent',
                cursor: 'pointer',
                transform: color === c ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform 0.15s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div style={{
        padding: '10px 14px', borderRadius: 12,
        background: color + '15', border: `1.5px solid ${color}44`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 22 }}>{emoji}</span>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
            {name || 'Habit name'}
          </div>
          {desc && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)' }}>{desc}</div>}
        </div>
      </div>

      <button
        className="btn-primary"
        disabled={!valid}
        style={{ opacity: valid ? 1 : 0.5 }}
        onClick={() => valid && onSave({ name: name.trim(), description: desc.trim() || undefined, color, emoji })}
      >
        {initial ? 'Save changes' : 'Add habit'}
      </button>

      {onDelete && (
        <button
          onClick={onDelete}
          style={{
            background: 'none', border: '1.5px solid #EF4444',
            color: '#EF4444', borderRadius: 12, minHeight: 44,
            fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14,
            cursor: 'pointer', width: '100%',
          }}
        >
          Delete habit
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface HabitsPageProps {
  data: HabitsData;
  onSave: (data: HabitsData) => void;
}

export default function HabitsPage({ data, onSave }: HabitsPageProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);

  const handleToggle = (habit: Habit, date: string) => {
    const failed = new Set(data.failedDates[habit.id] ?? []);
    if (failed.has(date)) {
      failed.delete(date); // mark done again
    } else {
      failed.add(date); // mark failed
    }
    onSave({
      ...data,
      failedDates: { ...data.failedDates, [habit.id]: Array.from(failed) },
    });
  };

  const handleCreate = (fields: Omit<Habit, 'id' | 'createdAt'>) => {
    const habit: Habit = {
      id: crypto.randomUUID(),
      createdAt: todayStr(),
      ...fields,
    };
    onSave({ ...data, habits: [...data.habits, habit] });
    setCreateOpen(false);
  };

  const handleEdit = (fields: Omit<Habit, 'id' | 'createdAt'>) => {
    if (!editHabit) return;
    const updated = data.habits.map(h =>
      h.id === editHabit.id ? { ...h, ...fields } : h
    );
    onSave({ ...data, habits: updated });
    setEditHabit(null);
  };

  const handleDelete = (id: string) => {
    const habits = data.habits.filter(h => h.id !== id);
    const failedDates = { ...data.failedDates };
    delete failedDates[id];
    onSave({ habits, failedDates });
    setEditHabit(null);
  };

  return (
    <div style={{ padding: '0 0 88px', maxWidth: 430, margin: '0 auto', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        padding: '52px 20px 16px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--text)', lineHeight: 1.2 }}>
            Habits
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', marginTop: 3 }}>
            {data.habits.length === 0 ? 'Add your first habit below' : `${data.habits.length} habit${data.habits.length > 1 ? 's' : ''} tracked`}
          </div>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--accent)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Plus size={20} color="white" />
        </button>
      </div>

      {/* Habits list */}
      <div style={{ padding: '0 16px' }}>
        {data.habits.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 48 }}>🌱</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>
              No habits yet
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', maxWidth: 240 }}>
              Every day counts. Tap + to start tracking your first habit.
            </div>
            <button className="btn-primary" style={{ maxWidth: 200, marginTop: 8 }} onClick={() => setCreateOpen(true)}>
              Add habit
            </button>
          </div>
        ) : (
          data.habits.map(habit => (
            <div
              key={habit.id}
              onDoubleClick={() => setEditHabit(habit)}
              style={{ cursor: 'default' }}
            >
              {/* Long-press / double-tap hint row */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
                <button
                  onClick={() => setEditHabit(habit)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', fontSize: 11,
                    color: 'var(--text-secondary)', padding: '0 2px',
                  }}
                >
                  Edit
                </button>
              </div>
              <HabitGrid
                habit={habit}
                failedDates={new Set(data.failedDates[habit.id] ?? [])}
                onToggle={(date) => handleToggle(habit, date)}
              />
            </div>
          ))
        )}
      </div>

      {/* Usage hint */}
      {data.habits.length > 0 && (
        <div style={{
          margin: '8px 20px 0',
          fontFamily: 'var(--font-sans)', fontSize: 12,
          color: 'var(--text-secondary)', textAlign: 'center',
        }}>
          Tap a cell to mark a day as missed. All days auto-count as done.
        </div>
      )}

      {/* Create sheet */}
      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="New Habit">
        <HabitForm onSave={handleCreate} onCancel={() => setCreateOpen(false)} />
      </BottomSheet>

      {/* Edit sheet */}
      <BottomSheet open={!!editHabit} onClose={() => setEditHabit(null)} title="Edit Habit">
        {editHabit && (
          <HabitForm
            initial={editHabit}
            onSave={handleEdit}
            onCancel={() => setEditHabit(null)}
            onDelete={() => handleDelete(editHabit.id)}
          />
        )}
      </BottomSheet>
    </div>
  );
}
