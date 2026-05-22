import React, { useState, useCallback } from 'react';
import { ChevronDown, Trash2, Coffee, Sun, Sunset, Utensils } from 'lucide-react';
import type { FoodEntry } from '../lib/storage';
import { BottomSheet } from './BottomSheet';

interface MealsSummaryProps {
  foods: FoodEntry[];
  onRemove: (id: string) => void;
  onEdit: (entry: FoodEntry) => void;
  onLogTap: () => void;
  onDeletedToast?: () => void;
}

const MEAL_CONFIG = [
  { id: 'breakfast', label: 'Breakfast', icon: <Coffee size={16} /> },
  { id: 'lunch', label: 'Lunch', icon: <Sun size={16} /> },
  { id: 'dinner', label: 'Dinner', icon: <Sunset size={16} /> },
  { id: 'snacks', label: 'Snacks', icon: <Utensils size={16} /> },
] as const;

// ── Food item row ─────────────────────────────────────────────────────────────

interface FoodRowProps {
  food: FoodEntry;
  isLast: boolean;
  onEdit: (entry: FoodEntry) => void;
  onRequestDelete: (entry: FoodEntry) => void;
  deleting: boolean;
}

function FoodRow({ food, isLast, onEdit, onRequestDelete, deleting }: FoodRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        cursor: 'pointer',
        opacity: deleting ? 0 : 1,
        transform: deleting ? 'translateX(100%)' : 'translateX(0)',
        transition: deleting ? 'opacity 200ms ease, transform 200ms ease' : 'none',
        overflow: 'hidden',
        gap: 10,
      }}
      onClick={() => !deleting && onEdit(food)}
    >
      {/* Optional photo thumbnail */}
      {food.imageBase64 && (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            overflow: 'hidden',
            flexShrink: 0,
            border: '1.5px solid var(--border)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <img
            src={`data:image/jpeg;base64,${food.imageBase64}`}
            alt={food.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {food.name}
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
          {food.quantity} {food.unit}
          {(food.protein || food.carbs || food.fat) ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {' '}· P:{food.protein || 0}g C:{food.carbs || 0}g F:{food.fat || 0}g
            </span>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
          {food.calories}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onRequestDelete(food); }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: '#ADADAD',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 36,
            minHeight: 44,
            borderRadius: 8,
            transition: 'color 0.15s ease',
          }}
          aria-label="Delete"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Meal Group ────────────────────────────────────────────────────────────────

interface MealGroupProps {
  label: string;
  icon: React.ReactNode;
  foods: FoodEntry[];
  deletingId: string | null;
  onEdit: (entry: FoodEntry) => void;
  onRequestDelete: (entry: FoodEntry) => void;
}

function MealGroup({ label, icon, foods, deletingId, onEdit, onRequestDelete }: MealGroupProps) {
  const [open, setOpen] = useState(true);
  const total = foods.reduce((s, f) => s + f.calories, 0);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          minHeight: 44,
        }}
      >
        <div style={{ color: 'var(--accent)', display: 'flex', flexShrink: 0 }}>{icon}</div>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1, textAlign: 'left' }}>
          {label}
        </span>
        {foods.length > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
            {total} kcal
          </span>
        )}
        <ChevronDown
          size={16}
          color="var(--text-secondary)"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }}
        />
      </button>

      {open && (
        <div>
          {foods.length === 0 ? (
            <div style={{ padding: '8px 16px 14px', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)' }}>
              Nothing logged yet
            </div>
          ) : (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />
              {foods.map((food, i) => (
                <FoodRow
                  key={food.id}
                  food={food}
                  isLast={i === foods.length - 1}
                  onEdit={onEdit}
                  onRequestDelete={onRequestDelete}
                  deleting={deletingId === food.id}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── MealsSummary ──────────────────────────────────────────────────────────────

export function MealsSummary({ foods, onRemove, onEdit, onLogTap, onDeletedToast }: MealsSummaryProps) {
  const [deleteTarget, setDeleteTarget] = useState<FoodEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    setDeletingId(id);
    setTimeout(() => {
      onRemove(id);
      setDeletingId(null);
      onDeletedToast?.();
    }, 210);
  }, [deleteTarget, onRemove, onDeletedToast]);

  const hasAny = foods.length > 0;

  if (!hasAny) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto 16px', display: 'block' }}>
          <circle cx="40" cy="40" r="38" stroke="var(--border)" strokeWidth="2" />
          <path d="M28 30 C28 26 32 22 40 22 C48 22 52 26 52 30 L52 46 C52 54 46 58 40 58 C34 58 28 54 28 46 Z" fill="var(--accent-light)" stroke="var(--accent)" strokeWidth="1.5" />
          <circle cx="34" cy="37" r="3" fill="var(--accent)" opacity="0.6" />
          <circle cx="46" cy="37" r="3" fill="var(--accent)" opacity="0.6" />
          <path d="M34 47 C36 50 44 50 46 47" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M38 22 L38 15 M42 22 L42 15" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>Nothing here yet</div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>Log your first meal to get started</div>
        <button onClick={onLogTap} className="btn-primary" style={{ maxWidth: 200, margin: '0 auto' }}>
          Log a meal
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MEAL_CONFIG.map(({ id, label, icon }) => (
          <MealGroup
            key={id}
            label={label}
            icon={icon}
            foods={foods.filter(f => f.mealType === id)}
            deletingId={deletingId}
            onEdit={onEdit}
            onRequestDelete={setDeleteTarget}
          />
        ))}
      </div>

      {/* Delete confirmation bottom sheet */}
      <BottomSheet
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete entry?"
      >
        {deleteTarget && (
          <>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Remove <strong style={{ color: 'var(--text)' }}>{deleteTarget.name}</strong> ({deleteTarget.calories} kcal) from today's log?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn-primary" style={{ background: '#E11D48' }} onClick={handleConfirmDelete}>Delete</button>
            </div>
          </>
        )}
      </BottomSheet>
    </>
  );
}
