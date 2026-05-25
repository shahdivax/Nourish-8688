import React, { useState, useMemo, useRef, useEffect } from 'react';
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

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABEL_ROWS = [1, 3, 5]; // Mon / Wed / Fri like GitHub
const HISTORY_RANGE_OPTIONS = [
  { months: 1, label: 'Past month', shortLabel: '1 mo' },
  { months: 3, label: 'Last 3 months', shortLabel: '3 mo' },
  { months: 6, label: 'Last 6 months', shortLabel: '6 mo' },
] as const;

type HistoryRangeMonths = (typeof HISTORY_RANGE_OPTIONS)[number]['months'];

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

function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split('T')[0];
}

/** Align to Sunday so columns are Sun→Sat (GitHub-style). */
function weekStartSunday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
}

type CellState = 'spacer' | 'inactive' | 'future' | 'done' | 'missed';

function cellState(date: string | null, habit: Habit, failedDates: Set<string>): CellState {
  if (!date) return 'spacer';
  const today = todayStr();
  if (date > today) return 'future';
  if (date < habit.createdAt) return 'inactive';
  return failedDates.has(date) ? 'missed' : 'done';
}

/** History window ending today; weeks as columns (oldest left, current month right). */
function buildGitHubWeeks(months: number): (string | null)[][] {
  const today = todayStr();
  const rangeStart = monthsAgo(months);
  let d = weekStartSunday(rangeStart);
  const flat: (string | null)[] = [];
  while (d <= today) {
    flat.push(d);
    d = addDays(d, 1);
  }
  const lastDow = new Date(today + 'T12:00:00').getDay();
  for (let i = lastDow + 1; i <= 6; i++) flat.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) {
    weeks.push(flat.slice(i, i + 7));
  }
  return weeks;
}

function monthLabelsForWeeks(weeks: (string | null)[][]): { label: string; col: number }[] {
  const labels: { label: string; col: number }[] = [];
  let lastMonth = '';
  weeks.forEach((week, wi) => {
    const first = week.find(d => d !== null);
    if (!first) return;
    const m = new Date(first + 'T12:00:00').toLocaleString('en-US', { month: 'short' });
    if (m !== lastMonth) {
      labels.push({ label: m, col: wi });
      lastMonth = m;
    }
  });
  return labels;
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

function getCompletionRate(habit: Habit, failedDates: Set<string>, months: number): number {
  const today = todayStr();
  const windowStart = monthsAgo(months);
  const trackFrom = habit.createdAt > windowStart ? habit.createdAt : windowStart;
  const total = daysBetween(trackFrom, today) + 1;
  if (total <= 0) return 100;
  const failed = Array.from(failedDates).filter(
    d => d >= trackFrom && d <= today,
  ).length;
  return Math.round(((total - failed) / total) * 100);
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function habitCellStyle(state: CellState, habit: Habit, isToday: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    width: '100%',
    aspectRatio: '1',
    borderRadius: 3,
    boxSizing: 'border-box',
  };
  switch (state) {
    case 'spacer':
      return { ...base, visibility: 'hidden' as const };
    case 'inactive':
    case 'future':
      return {
        ...base,
        background: 'var(--subtle)',
        border: '1px solid var(--border)',
        opacity: state === 'future' ? 0.45 : 0.7,
      };
    case 'missed':
      return {
        ...base,
        background: 'var(--subtle)',
        border: `1.5px solid ${habit.color}55`,
      };
    case 'done':
      return {
        ...base,
        background: habit.color,
        boxShadow: isToday ? `0 0 0 2px var(--card), 0 0 0 3.5px ${habit.color}` : undefined,
      };
    default:
      return base;
  }
}

function HabitGrid({
  habit,
  failedDates,
  historyMonths,
  historyLabel,
  onToggle,
}: {
  habit: Habit;
  failedDates: Set<string>;
  historyMonths: HistoryRangeMonths;
  historyLabel: string;
  onToggle: (date: string) => void;
}) {
  const today = todayStr();
  const weeks = useMemo(() => buildGitHubWeeks(historyMonths), [historyMonths]);
  const monthLabels = useMemo(() => monthLabelsForWeeks(weeks), [weeks]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streak = getCurrentStreak(habit, failedDates);
  const rate = getCompletionRate(habit, failedDates, historyMonths);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks.length, habit.id]);

  const CELL = 11;
  const GAP = 3;
  const LABEL_W = 26;

  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: 16,
      border: '1.5px solid var(--border)',
      padding: '14px 14px 12px',
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: habit.color + '22',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>
          {habit.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 700,
            fontSize: 16, color: 'var(--text)',
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
        <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: habit.color }}>
              {streak}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-secondary)' }}>streak</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: habit.color }}>
              {rate}%
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-secondary)' }}>{historyLabel}</div>
          </div>
        </div>
      </div>

      {/* GitHub-style grid (scroll starts at current month) */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{
          width: LABEL_W, flexShrink: 0, paddingTop: 16,
          display: 'grid',
          gridTemplateRows: `repeat(7, ${CELL}px)`,
          gap: GAP,
        }}>
          {DAY_LABELS.map((label, row) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                fontFamily: 'var(--font-sans)',
                fontSize: 9,
                color: 'var(--text-secondary)',
                opacity: DAY_LABEL_ROWS.includes(row) ? 1 : 0,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
          {/* Month row */}
          <div style={{ display: 'flex', gap: GAP, marginBottom: 4, height: 12 }}>
            {weeks.map((_, wi) => {
              const ml = monthLabels.find(m => m.col === wi);
              return (
                <div
                  key={wi}
                  style={{
                    width: CELL, flexShrink: 0,
                    fontFamily: 'var(--font-sans)', fontSize: 9,
                    color: 'var(--text-secondary)',
                    lineHeight: '12px',
                  }}
                >
                  {ml?.label ?? ''}
                </div>
              );
            })}
          </div>

          {/* Week columns */}
          <div style={{ display: 'flex', gap: GAP }}>
            {weeks.map((week, wi) => (
              <div
                key={wi}
                style={{
                  display: 'grid',
                  gridTemplateRows: `repeat(7, ${CELL}px)`,
                  gap: GAP,
                  flexShrink: 0,
                  width: CELL,
                }}
              >
                {week.map((date, di) => {
                  const state = cellState(date, habit, failedDates);
                  if (state === 'spacer') {
                    return <div key={di} style={{ width: CELL, height: CELL }} />;
                  }
                  const interactive = state === 'done' || state === 'missed';
                  const label = date
                    ? new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })
                    : '';
                  const stateLabel = state === 'inactive' ? ' · not tracked yet'
                    : state === 'future' ? ' · upcoming'
                    : state === 'missed' ? ' · missed'
                    : ' · done';

                  return (
                    <div
                      key={di}
                      className={interactive ? 'habit-cell' : undefined}
                      title={label + stateLabel}
                      onClick={() => date && interactive && onToggle(date)}
                      style={{
                        ...habitCellStyle(state, habit, date === today),
                        cursor: interactive ? 'pointer' : 'default',
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
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
  onSave: (h: Omit<Habit, 'id'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [color, setColor] = useState<HabitColor>(initial?.color ?? '#22C55E');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '💪');
  const [startDate, setStartDate] = useState(initial?.createdAt ?? todayStr());

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

      {/* Start date — backfill past days in the grid */}
      <div>
        <div className="label-caps" style={{ marginBottom: 6 }}>Tracking since</div>
        <input
          className="input"
          type="date"
          max={todayStr()}
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
        />
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
          Pick an earlier date to log habits for days before today.
        </div>
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
        onClick={() => valid && onSave({
          name: name.trim(),
          description: desc.trim() || undefined,
          color,
          emoji,
          createdAt: startDate,
        })}
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
  const [historyMonths, setHistoryMonths] = useState<HistoryRangeMonths>(6);
  const selectedHistoryRange = HISTORY_RANGE_OPTIONS.find(option => option.months === historyMonths) ?? HISTORY_RANGE_OPTIONS[2];

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

  const handleCreate = (fields: Omit<Habit, 'id'>) => {
    const habit: Habit = {
      id: crypto.randomUUID(),
      ...fields,
    };
    onSave({ ...data, habits: [...data.habits, habit] });
    setCreateOpen(false);
  };

  const handleEdit = (fields: Omit<Habit, 'id'>) => {
    if (!editHabit) return;
    const updated = data.habits.map(h =>
      h.id === editHabit.id ? { ...h, ...fields } : h
    );
    const failed = (data.failedDates[editHabit.id] ?? []).filter(d => d >= fields.createdAt);
    onSave({
      ...data,
      habits: updated,
      failedDates: { ...data.failedDates, [editHabit.id]: failed },
    });
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
        {data.habits.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="label-caps" style={{ marginBottom: 8 }}>History range</div>
            <div className="segmented">
              {HISTORY_RANGE_OPTIONS.map(option => (
                <button
                  key={option.months}
                  className={historyMonths === option.months ? 'active' : undefined}
                  onClick={() => setHistoryMonths(option.months)}
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>
          </div>
        )}
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
                historyMonths={historyMonths}
                historyLabel={selectedHistoryRange.shortLabel}
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
          {selectedHistoryRange.label} · scroll for history · tap a filled day to mark missed · muted cells = not tracked yet
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
