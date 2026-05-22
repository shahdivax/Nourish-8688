import React from 'react';
import { Home, PlusCircle, BarChart2, Settings, Sprout } from 'lucide-react';

export type TabId = 'home' | 'log' | 'insights' | 'habits' | 'settings';

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: React.ReactNode; large?: boolean }[] = [
  { id: 'home', label: 'Home', icon: <Home size={20} /> },
  { id: 'log', label: 'Log', icon: <PlusCircle size={24} />, large: true },
  { id: 'insights', label: 'Insights', icon: <BarChart2 size={20} /> },
  { id: 'habits', label: 'Habits', icon: <Sprout size={20} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
];

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        height: 60,
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        zIndex: 100,
      }}
    >
      {tabs.map(tab => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? 'var(--accent)' : '#ADADAD',
              transition: 'color 0.15s ease',
              padding: '6px 0 4px',
            }}
          >
            {tab.icon}
            <span style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              letterSpacing: '0.02em',
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
