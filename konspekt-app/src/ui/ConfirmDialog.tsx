import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import './confirm-dialog.css';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

const NamePromptContext = createContext<((title: string, placeholder: string) => Promise<string | null>) | null>(null);

export function useNamePrompt(): (title: string, placeholder: string) => Promise<string | null> {
  const ctx = useContext(NamePromptContext);
  if (!ctx) throw new Error('useNamePrompt must be used inside <ConfirmProvider>');
  return ctx;
}

interface PendingPrompt {
  title: string;
  placeholder: string;
  resolve: (value: string | null) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [prompt, setPrompt] = useState<PendingPrompt | null>(null);
  const [promptValue, setPromptValue] = useState('');

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const namePrompt = useCallback((title: string, placeholder: string) => {
    setPromptValue('');
    return new Promise<string | null>((resolve) => {
      setPrompt({ title, placeholder, resolve });
    });
  }, []);

  const close = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  const closePrompt = (value: string | null) => {
    prompt?.resolve(value);
    setPrompt(null);
  };

  const submitPrompt = () => {
    const val = promptValue.trim();
    closePrompt(val || null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      <NamePromptContext.Provider value={namePrompt}>
      {children}
      {pending && (
        <div className="name-editor" onClick={() => close(false)}>
          <div className="name-editor-box" onClick={(e) => e.stopPropagation()}>
            <div className="display" style={{ fontSize: 16 }}>{pending.title}</div>
            <div className="confirm-msg">{pending.message}</div>
            <div className="row">
              <button className="btn-ghost" onClick={() => close(false)}>Отмена</button>
              <button className="btn-danger" onClick={() => close(true)}>{pending.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
      {prompt && (
        <div className="name-editor" onClick={() => closePrompt(null)}>
          <div className="name-editor-box" onClick={(e) => e.stopPropagation()}>
            <div className="display" style={{ fontSize: 16 }}>{prompt.title}</div>
            <input
              autoFocus
              type="text"
              placeholder={prompt.placeholder}
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitPrompt(); if (e.key === 'Escape') closePrompt(null); }}
            />
            <div className="row">
              <button className="btn-ghost" onClick={() => closePrompt(null)}>Отмена</button>
              <button className="btn-primary" onClick={submitPrompt}>Добавить</button>
            </div>
          </div>
        </div>
      )}
      </NamePromptContext.Provider>
    </ConfirmContext.Provider>
  );
}
