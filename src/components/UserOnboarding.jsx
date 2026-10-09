import React, { useEffect, useMemo, useState } from 'react';

const STEP_ICONS = ['✦', '◌', '⌘', '◈'];

export default function UserOnboarding({
  isOpen,
  copy,
  isSignedIn,
  onComplete,
  onTryGoal,
  onOpenExplore,
  onOpenMemory
}) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (isOpen) setStepIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onComplete();
      if (event.key === 'ArrowRight') setStepIndex(index => Math.min(index + 1, 3));
      if (event.key === 'ArrowLeft') setStepIndex(index => Math.max(index - 1, 0));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onComplete]);

  const steps = useMemo(() => [
    {
      eyebrow: copy.steps.welcome.eyebrow,
      title: copy.steps.welcome.title,
      body: copy.steps.welcome.body,
      points: copy.steps.welcome.points
    },
    {
      eyebrow: copy.steps.goal.eyebrow,
      title: copy.steps.goal.title,
      body: copy.steps.goal.body,
      points: copy.steps.goal.points,
      action: { label: copy.steps.goal.action, onClick: onTryGoal }
    },
    {
      eyebrow: copy.steps.tools.eyebrow,
      title: copy.steps.tools.title,
      body: copy.steps.tools.body,
      points: copy.steps.tools.points,
      action: { label: copy.steps.tools.action, onClick: onOpenExplore }
    },
    {
      eyebrow: copy.steps.trust.eyebrow,
      title: copy.steps.trust.title,
      body: copy.steps.trust.body,
      points: isSignedIn ? copy.steps.trust.signedInPoints : copy.steps.trust.signedOutPoints,
      action: { label: isSignedIn ? copy.steps.trust.openMemory : copy.steps.trust.signInMemory, onClick: onOpenMemory }
    }
  ], [copy, isSignedIn, onOpenExplore, onOpenMemory, onTryGoal]);

  if (!isOpen) return null;

  const step = steps[stepIndex];
  const isFinalStep = stepIndex === steps.length - 1;

  return (
    <div className="onboarding-backdrop" onClick={onComplete}>
      <section
        className="onboarding-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="onboarding-skip"
          onClick={onComplete}
          aria-label={copy.skip}
        >
          {copy.skip}
        </button>

        <div className="onboarding-visual" aria-hidden="true">
          <span className="onboarding-orbit onboarding-orbit-one" />
          <span className="onboarding-orbit onboarding-orbit-two" />
          <span className="onboarding-orb">{STEP_ICONS[stepIndex]}</span>
        </div>

        <div className="onboarding-progress-copy">
          {copy.progress.replace('{current}', String(stepIndex + 1)).replace('{total}', String(steps.length))}
        </div>
        <div className="onboarding-progress" aria-hidden="true">
          {steps.map((item, index) => (
            <span key={item.title} className={index === stepIndex ? 'is-active' : index < stepIndex ? 'is-complete' : ''} />
          ))}
        </div>

        <div className="onboarding-content">
          <p className="onboarding-eyebrow">{step.eyebrow}</p>
          <h2 id="onboarding-title">{step.title}</h2>
          <p className="onboarding-body">{step.body}</p>
          <ul className="onboarding-points">
            {step.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
          {step.action && (
            <button type="button" className="onboarding-secondary-action" onClick={step.action.onClick}>
              {step.action.label} <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>

        <footer className="onboarding-footer">
          <button
            type="button"
            className="onboarding-back"
            onClick={() => setStepIndex(index => Math.max(index - 1, 0))}
            disabled={stepIndex === 0}
          >
            {copy.back}
          </button>
          <button
            type="button"
            className="onboarding-next"
            onClick={() => isFinalStep ? onComplete() : setStepIndex(index => index + 1)}
          >
            {isFinalStep ? copy.finish : copy.next} <span aria-hidden="true">→</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
