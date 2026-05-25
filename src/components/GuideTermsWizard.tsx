import { useEffect, useState } from 'react';
import { GUIDE_DOCUMENT_TITLE, GUIDE_INFO_STEPS, TERMS_AGREEMENT_TEXT } from '../content/guideTermsContent';
import { setAcceptedGuideAndTerms } from '../utils/onboardingStorage';
import { renderGuideParagraphWithEmphasis } from '../utils/guideEmphasis';

const TOTAL_STEPS = GUIDE_INFO_STEPS.length + 1;

interface Props {
  open: boolean;
  /** 初回: 同意チェック必須。ヘルプ: 閲覧のみで閉じるだけ */
  variant: 'onboarding' | 'help';
  /** 初回は「同意してアプリを使う」後にのみ呼ばれる。ヘルプでは閉じるたびに呼ばれる */
  onClose: () => void;
}

export default function GuideTermsWizard({ open, variant, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setAgreed(false);
  }, [open, variant]);

  useEffect(() => {
    if (!open || variant !== 'help') return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, variant, onClose]);

  if (!open) return null;

  const isLast = step === TOTAL_STEPS - 1;
  const isOnboarding = variant === 'onboarding';

  function handleBackdropClick() {
    if (!isOnboarding) onClose();
  }

  function handleComplete() {
    if (!isOnboarding || !agreed) return;
    setAcceptedGuideAndTerms();
    onClose();
  }

  return (
    <div
      className={`modal-backdrop guide-wizard-backdrop ${isOnboarding ? 'guide-wizard-backdrop--blocking' : ''}`}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="modal guide-wizard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-wizard-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal__header guide-wizard-header">
          <div>
            <div id="guide-wizard-title" className="guide-wizard-brand">
              {GUIDE_DOCUMENT_TITLE}
            </div>
            <div className="guide-wizard-step-label">
              {isOnboarding ? '初回のみ表示' : 'ヘルプ'}
              {' · '}
              ステップ {step + 1} / {TOTAL_STEPS}
            </div>
          </div>
          {!isOnboarding && (
            <button type="button" className="modal__close" onClick={onClose} aria-label="閉じる">
              ✕
            </button>
          )}
        </div>

        <div className="modal__body guide-wizard-body">
          {!isLast && (
            <>
              <h2 className="guide-wizard-step-title">{GUIDE_INFO_STEPS[step].title}</h2>
              <div className="guide-wizard-text">
                {GUIDE_INFO_STEPS[step].paragraphs.map((p, i) => (
                  <p key={i}>{renderGuideParagraphWithEmphasis(p)}</p>
                ))}
              </div>
            </>
          )}
          {isLast && (
            <>
              <h2 className="guide-wizard-step-title">利用規約への同意</h2>
              {!isOnboarding && (
                <p className="guide-wizard-note">
                  初回起動時には、以下の内容にチェックを入れたうえで「同意してアプリを使う」が必要でした。内容はいつでもここで確認できます。
                </p>
              )}
              <pre className="guide-wizard-terms">{TERMS_AGREEMENT_TEXT}</pre>
              {isOnboarding && (
                <label className="guide-wizard-agree">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                  />
                  <span>上記を読み、内容を理解したうえで利用に同意します</span>
                </label>
              )}
            </>
          )}
        </div>

        <div className="delete-modal__footer guide-wizard-footer">
          {!isLast && (
            <>
              <button
                type="button"
                className="btn-cancel"
                disabled={step === 0}
                onClick={() => setStep(s => Math.max(0, s - 1))}
              >
                戻る
              </button>
              <button type="button" className="btn-primary" onClick={() => setStep(s => s + 1)}>
                次へ
              </button>
            </>
          )}
          {isLast && (
            <>
              <button type="button" className="btn-cancel" onClick={() => setStep(s => Math.max(0, s - 1))}>
                戻る
              </button>
              {isOnboarding ? (
                <button
                  type="button"
                  className="btn-primary guide-wizard-ok"
                  disabled={!agreed}
                  onClick={handleComplete}
                >
                  同意してアプリを使う
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={onClose}>
                  閉じる
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
