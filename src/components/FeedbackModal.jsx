import React, { useEffect, useState } from 'react';

export const FEEDBACK_COPY = {
  en: { action: 'Send feedback', description: 'Rate Lumen or share an optional note.', title: 'Help improve Lumen', intro: 'How was your experience? Leave an optional note.', rating: 'Your rating', comment: 'What should we know? (optional)', placeholder: 'Share an idea or describe a problem…', privacy: 'This opens a public GitHub issue draft. Nothing is posted until you review and submit it. Your conversation, files, and screenshots are not included.', cancel: 'Cancel', submit: 'Review feedback on GitHub', ratingLabel: (n) => `${n} out of 5` },
  es: { action: 'Enviar comentarios', description: 'Valora Lumen o comparte una nota opcional.', title: 'Ayuda a mejorar Lumen', intro: '¿Qué te pareció la experiencia? Puedes dejar una nota.', rating: 'Tu valoración', comment: '¿Qué deberíamos saber? (opcional)', placeholder: 'Comparte una idea o describe un problema…', privacy: 'Se abrirá un borrador público en GitHub. No se publicará hasta que lo revises y lo envíes. No se incluyen conversaciones, archivos ni capturas.', cancel: 'Cancelar', submit: 'Revisar en GitHub', ratingLabel: (n) => `${n} de 5` },
  fr: { action: 'Envoyer un commentaire', description: 'Évaluez Lumen ou partagez une note facultative.', title: 'Aidez-nous à améliorer Lumen', intro: 'Comment s’est passée votre expérience ? Une note est facultative.', rating: 'Votre note', comment: 'Que devons-nous savoir ? (facultatif)', placeholder: 'Proposez une idée ou décrivez un problème…', privacy: 'Un brouillon public GitHub va s’ouvrir. Rien ne sera publié avant votre vérification et votre envoi. Vos conversations, fichiers et captures ne sont pas inclus.', cancel: 'Annuler', submit: 'Vérifier sur GitHub', ratingLabel: (n) => `${n} sur 5` },
  de: { action: 'Feedback senden', description: 'Bewerte Lumen oder hinterlasse eine optionale Notiz.', title: 'Lumen verbessern', intro: 'Wie war dein Erlebnis? Eine Notiz ist optional.', rating: 'Deine Bewertung', comment: 'Was sollten wir wissen? (optional)', placeholder: 'Teile eine Idee oder beschreibe ein Problem…', privacy: 'Es öffnet sich ein öffentlicher GitHub-Entwurf. Erst nach deiner Prüfung und dem Absenden wird etwas veröffentlicht. Chats, Dateien und Screenshots werden nicht angefügt.', cancel: 'Abbrechen', submit: 'Feedback auf GitHub prüfen', ratingLabel: (n) => `${n} von 5` },
  ja: { action: 'フィードバックを送信', description: 'Lumen の評価やコメントを共有できます。', title: 'Lumen の改善に協力', intro: '使い心地を教えてください。コメントは任意です。', rating: '評価', comment: 'ご意見 (任意)', placeholder: 'アイデアや問題点を入力…', privacy: 'GitHub の公開下書きを開きます。確認して送信するまで公開されません。会話、ファイル、スクリーンショットは含まれません。', cancel: 'キャンセル', submit: 'GitHub で確認', ratingLabel: (n) => `5 段階中 ${n}` },
  it: { action: 'Invia un feedback', description: 'Valuta Lumen o condividi una nota facoltativa.', title: 'Aiuta a migliorare Lumen', intro: 'Com’è stata la tua esperienza? Puoi aggiungere una nota facoltativa.', rating: 'La tua valutazione', comment: 'Cosa dovremmo sapere? (facoltativo)', placeholder: 'Condividi un’idea o descrivi un problema…', privacy: 'Si aprirà una bozza pubblica su GitHub. Non verrà pubblicato nulla finché non la rivedi e invii. Conversazioni, file e schermate non sono inclusi.', cancel: 'Annulla', submit: 'Rivedi il feedback su GitHub', ratingLabel: (n) => `${n} su 5` }
};

export function getFeedbackCopy(activeLanguage = 'en-US') {
  return FEEDBACK_COPY[String(activeLanguage).slice(0, 2)] || FEEDBACK_COPY.en;
}

export default function FeedbackModal({ isOpen, onClose, activeLanguage = 'en-US' }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const copy = getFeedbackCopy(activeLanguage);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setRating(0);
      setComment('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const continueToGitHub = () => {
    const body = [
      '## Lumen feedback',
      `**Rating:** ${rating}/5`,
      '',
      '## Comment',
      comment.trim() || '(No comment provided)',
      '',
      '<!-- Review this draft and remove anything private before submitting. -->'
    ].join('\n');
    const url = new URL('https://github.com/georgieslab/lumen-ai/issues/new');
    url.searchParams.set('title', `Lumen feedback: ${rating}/5`);
    url.searchParams.set('body', body);
    window.open(url.href, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="feedback-backdrop" onClick={onClose}>
      <section
        className="feedback-card glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="feedback-header">
          <div>
            <h2 id="feedback-title">{copy.title}</h2>
            <p>{copy.intro}</p>
          </div>
          <button type="button" className="share-close-btn" onClick={onClose} aria-label={copy.cancel}>×</button>
        </header>

        <fieldset className="feedback-rating">
          <legend>{copy.rating}</legend>
          <div className="feedback-stars" role="group" aria-label={copy.rating}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={rating === value}
                aria-label={copy.ratingLabel(value)}
                title={copy.ratingLabel(value)}
                className={value <= rating ? 'selected' : ''}
                onClick={() => setRating(value)}
              >★</button>
            ))}
          </div>
        </fieldset>

        <label className="feedback-comment-label" htmlFor="feedback-comment">{copy.comment}</label>
        <textarea
          id="feedback-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value.slice(0, 2000))}
          placeholder={copy.placeholder}
          maxLength={2000}
          rows={5}
        />
        <p className="feedback-privacy-note">{copy.privacy}</p>
        <footer className="feedback-actions">
          <button type="button" className="feedback-cancel-btn" onClick={onClose}>{copy.cancel}</button>
          <button type="button" className="feedback-submit-btn" onClick={continueToGitHub} disabled={!rating && !comment.trim()}>{copy.submit}</button>
        </footer>
      </section>
    </div>
  );
}
