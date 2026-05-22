import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppActions } from '../App';
import type { Category, ExpenseAppData, ExpenseProfile } from '../types';
import { parseQuickAdd, formatDisplayDate } from '../utils/quickAddParser';
import type { ParsedTransactionDraft } from '../utils/quickAddParser';
import { imageForCategory } from '../utils/categoryIconMap';
import { formatDate, parseDateStart } from '../utils/date';
import * as repo from '../lib/repository';
import { guessIconKeyFromName } from '../utils/categoryIcons';

// ─── UUID polyfill (crypto.randomUUID is unavailable on older iOS Safari) ─────
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4 UUID via Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Web Speech API shim types ─────────────────────────────────────────────

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

// ─── Props ─────────────────────────────────────────────────────────────────

export interface EasyAddDialogProps {
  open: boolean;
  onClose: () => void;
  appData: ExpenseAppData;
  activeProfile: ExpenseProfile;
  actions: AppActions;
  /** Called when user taps "Edit Details" — fills the parent form */
  onEditDetails: (draft: ParsedTransactionDraft) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

type Step = 'input' | 'confirm';

export default function EasyAddDialog({
  open,
  onClose,
  appData,
  activeProfile,
  actions,
  onEditDetails,
}: EasyAddDialogProps) {
  const [step, setStep] = useState<Step>('input');
  const [quickNote, setQuickNote] = useState('');
  const [parseError, setParseError] = useState('');
  const [draft, setDraft] = useState<ParsedTransactionDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [categoryWarning, setCategoryWarning] = useState('');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const saveGuardRef = useRef(false); // prevent double-tap

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('input');
      setQuickNote('');
      setParseError('');
      setDraft(null);
      setSaving(false);
      setListening(false);
      setVoiceError('');
      setCategoryWarning('');
      saveGuardRef.current = false;
    }
  }, [open]);

  const voiceSupported =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition !== undefined || window.webkitSpeechRecognition !== undefined);

  // ── Parse handler ─────────────────────────────────────────────────────────

  const handleParse = useCallback((text: string) => {
    const today = formatDate(Date.now());
    const result = parseQuickAdd(
      text,
      appData.currencyCode,
      today,
      activeProfile.categoryObjects,
    );

    if (!result.ok) {
      setParseError(result.error);
      return;
    }

    setParseError('');
    const d = result.draft;

    // Check if category exists in profile
    const catExists = activeProfile.categories.some(
      (c) => c.toLowerCase() === d.category.toLowerCase(),
    );
    if (!catExists) {
      setCategoryWarning('This category will be added before saving.');
    } else {
      setCategoryWarning('');
    }

    setDraft(d);
    setStep('confirm');
  }, [appData.currencyCode, activeProfile]);

  // ── Voice input ───────────────────────────────────────────────────────────

  function startVoice() {
    if (!voiceSupported) {
      setVoiceError('Voice input is not supported in this browser. Please type your note.');
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    try {
      const recognition = new SR();
      recognition.lang = 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0]?.[0]?.transcript || '';
        setQuickNote(transcript);
        setListening(false);
        // Auto-run parser
        if (transcript) handleParse(transcript);
      };

      recognition.onerror = () => {
        setListening(false);
        setVoiceError('Voice recognition failed. Please type your note instead.');
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      setVoiceError('');
    } catch {
      setVoiceError('Voice input is not supported in this browser. Please type your note.');
    }
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  // ── Confirm Add ───────────────────────────────────────────────────────────

  async function handleConfirmAdd() {
    if (!draft || saveGuardRef.current) return;
    saveGuardRef.current = true;
    setSaving(true);

    try {
      // If category doesn't exist, insert it first
      const catExists = activeProfile.categories.some(
        (c) => c.toLowerCase() === draft.category.toLowerCase(),
      );

      if (!catExists) {
        const iconKey = guessIconKeyFromName(draft.category);
        try {
          const saved = await repo.insertCategory(draft.category, activeProfile.id, iconKey);
          // Update appData optimistically
          actions.setAppData((current) => {
            if (!current) return current;
            const profiles = [...current.profiles];
            const ix = current.activeProfileIndex;
            profiles[ix] = {
              ...profiles[ix],
              categories: [...profiles[ix].categories, saved.name],
              categoryObjects: [...profiles[ix].categoryObjects, saved],
            };
            return { ...current, profiles };
          });
        } catch {
          // Duplicate or error → continue anyway
        }
      }

      const dateMillis = parseDateStart(draft.date) ?? Date.now();

      await actions.addTransaction({
        id: generateId(),
        type: draft.type,
        title: draft.title,
        category: draft.type === 'INCOME' ? 'Income' : draft.category,
        amount: draft.amount,
        baseCurrency: draft.currency,
        displayCurrency: appData.currencyCode,
        dateMillis,
        note: draft.note,
      });

      // actions.addTransaction already navigates to /home
    } catch (err) {
      setSaving(false);
      saveGuardRef.current = false;
      alert('Save failed: ' + (err as Error).message);
    }
  }

  // ── Edit Details ──────────────────────────────────────────────────────────

  function handleEditDetails() {
    if (!draft) return;
    onEditDetails(draft);
    onClose();
  }

  if (!open) return null;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="easy-add-sheet">
        {/* ── Header ── */}
        <div className="easy-add-header">
          <div>
            <h2 className="text-xl font-extrabold text-[#101828]">⚡ Easy Add</h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Type or speak a quick note and verify before saving.
            </p>
          </div>
          <button
            className="outline-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {step === 'input' && (
          <div className="space-y-4">
            {/* ── Quick Note Field ── */}
            <div>
              <label className="label" htmlFor="easy-add-note">Quick note</label>
              <textarea
                id="easy-add-note"
                className="easy-add-textarea"
                placeholder="Example: food 60 morning"
                value={listening ? 'Listening…' : quickNote}
                disabled={listening}
                onChange={(e) => {
                  setQuickNote(e.target.value);
                  setParseError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleParse(quickNote);
                  }
                }}
                rows={2}
                autoFocus
              />
              {parseError && (
                <p className="mt-1.5 flex items-center gap-1 text-[13px] font-semibold text-red-600">
                  ⚠️ {parseError}
                </p>
              )}
              {voiceError && (
                <p className="mt-1.5 text-[13px] text-slate-500">{voiceError}</p>
              )}
            </div>

            {/* ── Examples row ── */}
            <div className="flex flex-wrap gap-1.5">
              {['food 60 morning', 'petrol 500', 'salary 20000 income', 'zepto 240'].map((ex) => (
                <button
                  key={ex}
                  className="easy-add-chip"
                  onClick={() => { setQuickNote(ex); setParseError(''); }}
                >
                  {ex}
                </button>
              ))}
            </div>

            {/* ── Action buttons ── */}
            <div className="flex gap-2">
              {voiceSupported && (
                <button
                  className={`outline-btn flex-none gap-1.5 ${listening ? 'border-red-400 text-red-600' : 'text-blue-600'}`}
                  onClick={listening ? stopVoice : startVoice}
                  aria-label={listening ? 'Stop listening' : 'Speak'}
                >
                  {listening ? '⏹ Stop' : '🎤 Speak'}
                </button>
              )}
              <button
                className="primary-btn flex-1"
                onClick={() => handleParse(quickNote)}
              >
                Understand
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && draft && (
          <div className="space-y-4">
            {/* ── Confirmation card ── */}
            <div className="easy-add-confirm-card">
              {/* Type badge */}
              <div className="mb-3 flex items-center gap-2">
                <span className={`easy-add-type-badge ${draft.type === 'INCOME' ? 'income' : 'expense'}`}>
                  {draft.type === 'INCOME' ? '💰 Income' : '💸 Expense'}
                </span>
                {draft.confidence < 0.7 && (
                  <span className="text-[12px] text-amber-600 font-medium">Low confidence — please verify</span>
                )}
              </div>

              <div className="space-y-2">
                <Row label="Title" value={draft.title} />
                <RowWithIcon label="Category" categoryName={draft.category} />
                <Row
                  label="Amount"
                  value={`${draft.currency} ${draft.amount.toLocaleString('en-IN', { minimumFractionDigits: draft.amount % 1 !== 0 ? 2 : 0 })}`}
                />
                <Row label="Date" value={formatDisplayDate(draft.date)} />
                {draft.note && <Row label="Note" value={draft.note} />}
              </div>

              {categoryWarning && (
                <div className="easy-add-cat-warning">
                  ⚠️ {categoryWarning}
                </div>
              )}
            </div>

            {/* ── Buttons ── */}
            <button
              className="primary-btn w-full"
              disabled={saving}
              onClick={handleConfirmAdd}
            >
              {saving ? 'Saving…' : '✓ Confirm Add'}
            </button>

            <div className="flex gap-2">
              <button
                className="outline-btn flex-1"
                onClick={handleEditDetails}
                disabled={saving}
              >
                ✏️ Edit Details
              </button>
              <button
                className="outline-btn flex-1 text-slate-500"
                onClick={() => { setStep('input'); setSaving(false); saveGuardRef.current = false; }}
                disabled={saving}
              >
                ← Back
              </button>
            </div>

            <button
              className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex-none text-[13px] font-semibold text-slate-500 w-20">{label}</span>
      <span className="text-right text-[14px] font-semibold text-[#101828] break-words">{value}</span>
    </div>
  );
}

/** Row variant that renders a PNG category icon next to the category name. */
function RowWithIcon({ label, categoryName }: { label: string; categoryName: string }) {
  const src = imageForCategory(categoryName);
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex-none text-[13px] font-semibold text-slate-500 w-20">{label}</span>
      <span className="flex items-center gap-1.5 text-right text-[14px] font-semibold text-[#101828]">
        <img src={src} alt={categoryName} className="cat-icon-dropdown" />
        {categoryName}
      </span>
    </div>
  );
}
