import React, { useState } from 'react';
import { X, Copy, Check, AlertTriangle, ExternalLink } from 'lucide-react';

export interface AIErrorInfo {
  title: string;
  message: string;      // human-readable summary
  detail: string;       // raw / technical detail — the copyable part
  provider?: string;
  statusCode?: number;
}

interface AIErrorModalProps {
  error: AIErrorInfo | null;
  onClose: () => void;
}

export function AIErrorModal({ error, onClose }: AIErrorModalProps) {
  const [copied, setCopied] = useState(false);

  if (!error) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${error.title}\n\n${error.message}\n\n--- Technical detail ---\n${error.detail}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback — select the text area
      const el = document.getElementById('ai-error-detail') as HTMLTextAreaElement | null;
      el?.select();
    }
  };

  const settingsHint = error.message.includes('API key') || error.statusCode === 401 || error.statusCode === 403;
  const quotaHint = error.statusCode === 429;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 10000, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ai-err-title"
        style={{
          position: 'fixed',
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10001,
          background: 'var(--card)',
          borderRadius: 20,
          padding: '24px 20px 20px',
          width: 'min(92vw, 420px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={20} color="#DC2626" />
          </div>
          <div style={{ flex: 1 }}>
            <div id="ai-err-title" style={{
              fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700,
              color: 'var(--text)', marginBottom: 4,
            }}>
              {error.title}
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 14,
              color: 'var(--text-secondary)', lineHeight: 1.5,
            }}>
              {error.message}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, color: 'var(--text-secondary)', flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Hints */}
        {settingsHint && (
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'var(--accent-light)', border: '1.5px solid var(--accent)',
            fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--accent)', fontWeight: 500,
          }}>
            Go to <strong>Settings → AI Scan</strong> to update your API key or switch models.
          </div>
        )}
        {quotaHint && (
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: '#FFFBEB', border: '1.5px solid #D97706',
            fontFamily: 'var(--font-sans)', fontSize: 13, color: '#92400E', fontWeight: 500,
          }}>
            You've hit your rate limit or usage quota. Wait a moment or check your plan.
          </div>
        )}

        {/* Copyable detail */}
        {error.detail && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600,
                color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Error detail
              </span>
              <button
                onClick={handleCopy}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'none', border: '1.5px solid var(--border)',
                  borderRadius: 8, padding: '3px 10px', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
                  color: copied ? '#16A34A' : 'var(--text-secondary)',
                  transition: 'color 0.15s',
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <textarea
              id="ai-error-detail"
              readOnly
              value={error.detail}
              onClick={e => (e.target as HTMLTextAreaElement).select()}
              style={{
                width: '100%', minHeight: 80, maxHeight: 160,
                padding: '10px 12px', borderRadius: 10,
                border: '1.5px solid var(--border)',
                background: 'var(--subtle)',
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--text)', resize: 'vertical',
                boxSizing: 'border-box', lineHeight: 1.5,
              }}
            />
          </div>
        )}

        {/* Provider docs link */}
        {error.provider && (
          <a
            href={PROVIDER_DOCS[error.provider as keyof typeof PROVIDER_DOCS] || '#'}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--accent)',
              textDecoration: 'none', fontWeight: 500,
            }}
          >
            <ExternalLink size={13} />
            View {PROVIDER_NAMES[error.provider as keyof typeof PROVIDER_NAMES] || error.provider} API dashboard
          </a>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="btn-ghost"
          style={{ marginTop: 4 }}
        >
          Dismiss
        </button>
      </div>
    </>
  );
}

const PROVIDER_DOCS = {
  openai: 'https://platform.openai.com/usage',
  anthropic: 'https://console.anthropic.com',
  gemini: 'https://aistudio.google.com/app/apikey',
};

const PROVIDER_NAMES = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google AI',
};

// ── Error parser ──────────────────────────────────────────────────────────────
// Converts any thrown value from AI calls into a structured AIErrorInfo.

export function parseAIError(err: unknown, provider?: string): AIErrorInfo {
  // Not configured
  if (err instanceof Error && err.message === 'no_config') {
    return {
      title: 'AI not configured',
      message: 'No AI model is set up. Go to Settings → AI Scan to add your API key and pick a model.',
      detail: '',
      provider,
    };
  }

  // JSON parse failure (bad model response)
  if (err instanceof SyntaxError) {
    return {
      title: 'Unexpected AI response',
      message: "The AI returned something we couldn't parse. Try again or switch to a different model.",
      detail: err.message,
      provider,
    };
  }

  // OpenAI SDK / fetch error with status
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;

    // OpenAI SDK wraps as APIError with .status + .message
    const status = (e.status ?? e.statusCode) as number | undefined;
    const rawMsg = (e.message ?? e.error ?? '') as string;
    const rawDetail = e.error
      ? JSON.stringify(e.error, null, 2)
      : e.message
      ? String(e.message)
      : JSON.stringify(e, null, 2);

    if (status === 401 || status === 403) {
      return {
        title: 'Invalid API key',
        message: 'Your API key was rejected. Check it in Settings → AI Scan.',
        detail: rawDetail,
        provider,
        statusCode: status,
      };
    }
    if (status === 429) {
      return {
        title: 'Rate limit exceeded',
        message: "You've hit the provider's rate limit or quota. Wait and try again.",
        detail: rawDetail,
        provider,
        statusCode: status,
      };
    }
    if (status === 404) {
      return {
        title: 'Model not found',
        message: 'The selected model does not exist or your key has no access to it. Try a different model in Settings.',
        detail: rawDetail,
        provider,
        statusCode: status,
      };
    }
    if (status && status >= 500) {
      return {
        title: 'Provider server error',
        message: `The AI provider returned a ${status} error. This is on their end — try again shortly.`,
        detail: rawDetail,
        provider,
        statusCode: status,
      };
    }
    if (rawMsg) {
      return {
        title: 'AI request failed',
        message: rawMsg.length > 200 ? rawMsg.slice(0, 200) + '…' : rawMsg,
        detail: rawDetail,
        provider,
        statusCode: status,
      };
    }
  }

  // Network / unknown — also unwrap APIConnectionError cause chain
  let msg = err instanceof Error ? err.message : String(err);
  // OpenAI SDK APIConnectionError: real cause is in err.cause
  if (err instanceof Error && err.cause) {
    const cause = err.cause instanceof Error ? err.cause.message : String(err.cause);
    msg = `${msg}\nCause: ${cause}`;
  }
  const isNetwork = /fetch|network|failed to|ECONNREFUSED|ETIMEDOUT|connection error/i.test(msg);
  const isCORS = /CORS|cross.origin|blocked/i.test(msg);
  return {
    title: isCORS ? 'CORS / browser restriction' : isNetwork ? 'Network error' : 'AI request failed',
    message: isCORS
      ? 'Your browser blocked the request to the AI provider. This provider may not support direct browser access. Try OpenAI or Gemini instead.'
      : isNetwork
      ? 'Could not reach the AI provider. Check your internet connection.'
      : msg.length > 200 ? msg.slice(0, 200) + '…' : msg,
    detail: msg,
    provider,
  };
}
