import React, { useEffect, useState } from 'react';
import type { Toast } from '../hooks/useNourish';
import { CheckCircle, X, AlertCircle } from 'lucide-react';

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 250);
  };

  return (
    <div
      className={exiting ? 'toast-exit' : 'toast-enter'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: '#1C1C1E',
        color: 'white',
        borderRadius: '12px',
        padding: '12px 16px',
        minWidth: '200px',
        maxWidth: '320px',
        fontFamily: 'var(--font-sans)',
        fontSize: '14px',
        fontWeight: 500,
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      }}
    >
      {toast.type === 'error' ? (
        <AlertCircle size={16} color="#FF6B6B" />
      ) : (
        <CheckCircle size={16} color="#4ADE80" />
      )}
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={handleDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'rgba(255,255,255,0.5)', display: 'flex' }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => (
        <div key={toast.id} style={{ pointerEvents: 'all' }}>
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
