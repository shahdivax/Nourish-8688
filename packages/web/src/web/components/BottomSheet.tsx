import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Sheet — sits ABOVE bottom nav (68px) + device safe area */}
      <div
        ref={sheetRef}
        style={{
          position: 'relative',
          background: 'var(--card)',
          borderRadius: '20px 20px 0 0',
          paddingTop: '20px',
          paddingLeft: '20px',
          paddingRight: '20px',
          // bottom padding: nav bar height (68px) + safe area inset
          paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))',
          animation: 'slideUp 0.25s ease',
          // max height leaves room above the nav bar
          maxHeight: 'calc(92vh - 68px)',
          overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div style={{
          width: 36,
          height: 4,
          background: 'var(--border)',
          borderRadius: 2,
          margin: '0 auto 16px',
        }} />

        {/* Header */}
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--text)' }}>{title}</h3>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary)', display: 'flex' }}
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Scrollable content wrapper with bottom breathing room */}
        <div style={{ paddingBottom: 24 }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
