import React, { useState } from 'react';
import { Droplets } from 'lucide-react';

interface WaterCardProps {
  glasses: number;
  goal: number; // in litres, e.g. 2.5
  onToggle: (glasses: number) => void;
}

export function WaterCard({ glasses, goal, onToggle }: WaterCardProps) {
  const [pressed, setPressed] = useState<number | null>(null);
  const totalGlasses = 8; // 8 × 250ml = 2L base, we scale for goal
  const mlPerGlass = (goal * 1000) / totalGlasses;
  const totalMl = glasses * mlPerGlass;

  const handleTap = (index: number) => {
    setPressed(index);
    setTimeout(() => setPressed(null), 200);

    // Toggle: if tapping the last filled one, unfill it; else fill up to that point
    if (index < glasses) {
      // clicking a filled glass — unfill from here
      onToggle(index);
    } else {
      // clicking an unfilled glass — fill up to here
      onToggle(index + 1);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div className="label-caps" style={{ marginBottom: 4 }}>Hydration</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>
            {totalMl < 1000 ? `${Math.round(totalMl)}ml` : `${(totalMl / 1000).toFixed(1)}L`}
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 4 }}>
              / {goal}L goal
            </span>
          </div>
        </div>
        <div style={{ color: glasses >= totalGlasses ? 'var(--accent)' : 'var(--text-secondary)' }}>
          <Droplets size={22} />
        </div>
      </div>

      {/* Droplets */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        {Array.from({ length: totalGlasses }, (_, i) => {
          const filled = i < glasses;
          const isPressed = pressed === i;
          return (
            <button
              key={i}
              className="droplet-btn"
              onClick={() => handleTap(i)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                transform: isPressed ? 'scale(0.85)' : 'scale(1)',
                transition: 'transform 0.15s ease',
              }}
            >
              <svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M10 1C10 1 2 9.5 2 15C2 19.4183 5.58172 23 10 23C14.4183 23 18 19.4183 18 15C18 9.5 10 1 10 1Z"
                  fill={filled ? 'var(--accent)' : 'var(--border)'}
                  stroke={filled ? 'var(--accent)' : 'var(--border)'}
                  strokeWidth="1"
                />
              </svg>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 8, fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
        {Math.round(mlPerGlass)}ml per glass · tap to track
      </div>
    </div>
  );
}
