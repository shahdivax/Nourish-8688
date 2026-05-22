import React, { useEffect, useState } from 'react';

interface CalorieRingProps {
  consumed: number;
  target: number;
  protein: number;
  carbs: number;
  fat: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
}

export function CalorieRing({
  consumed,
  target,
  protein,
  carbs,
  fat,
  proteinTarget,
  carbsTarget,
  fatTarget,
}: CalorieRingProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const size = 200;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const pct = Math.min(consumed / Math.max(target, 1), 1);
  const offset = circumference - (animated ? pct * circumference : 0);
  const remaining = Math.max(target - consumed, 0);
  const over = consumed > target;

  const macroBar = (value: number, goal: number, color: string, label: string) => {
    const pct = Math.min(value / Math.max(goal, 1), 1);
    return (
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}>{value}g</span>
        </div>
        <div style={{
          height: 4,
          background: 'var(--subtle)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${pct * 100}%`,
            background: color,
            borderRadius: 2,
            transition: 'width 600ms ease',
          }} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      {/* Ring */}
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={over ? '#E5A399' : 'var(--accent)'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: animated ? 'stroke-dashoffset 600ms ease-out' : 'none',
            }}
          />
        </svg>

        {/* Center text */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 36,
            fontWeight: 500,
            color: over ? 'var(--accent)' : 'var(--text)',
            lineHeight: 1,
          }}>
            {over ? `+${consumed - target}` : remaining}
          </div>
          <div style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: 'var(--text-secondary)',
            marginTop: 4,
            fontWeight: 500,
          }}>
            {over ? 'over goal' : 'remaining'}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-secondary)',
            marginTop: 2,
          }}>
            {consumed} / {target}
          </div>
        </div>
      </div>

      {/* Macro bars */}
      <div style={{
        display: 'flex',
        gap: 16,
        width: '100%',
      }}>
        {macroBar(protein, proteinTarget, '#1C1C1E', 'Protein')}
        {macroBar(carbs, carbsTarget, '#D97706', 'Carbs')}
        {macroBar(fat, fatTarget, '#E11D48', 'Fat')}
      </div>
    </div>
  );
}
