import React, { useState } from 'react';
import { PLAN_LIMITS, sanitizePlan } from '../../services/missionPlan.js';

const LABELS = {
  en: {
    title: 'Plan for your approval', intro: 'Nothing is searched until you press Start. Edit or remove anything below.',
    questions: 'What Lumen will look for', add: 'Add a question', remove: 'Remove', placeholder: 'A question or search',
    pages: 'Total pages to read', output: 'You get a sourced report with a downloadable PDF. Lumen only reads public web pages.',
    adaptive: 'Adaptive evidence check', adaptiveOn: 'On', adaptiveOff: 'Off', adaptiveHint: 'When on, Lumen may run one targeted follow-up search after checking for evidence gaps. It stays within the page limit above.',
    start: 'Start research', cancel: 'Cancel', cancelled: 'Cancelled', cancelledText: 'Research cancelled. Nothing was searched.',
    needOne: 'Keep at least one question.'
  },
  es: {
    title: 'Plan para tu aprobación', intro: 'No se busca nada hasta que pulses Iniciar. Edita o elimina lo que quieras.',
    questions: 'Qué buscará Lumen', add: 'Añadir una pregunta', remove: 'Quitar', placeholder: 'Una pregunta o búsqueda',
    pages: 'Páginas totales a leer', output: 'Recibes un informe con fuentes y un PDF descargable. Lumen solo lee páginas web públicas.',
    adaptive: 'Comprobación adaptativa de evidencias', adaptiveOn: 'Activada', adaptiveOff: 'Desactivada', adaptiveHint: 'Si está activada, Lumen puede hacer una búsqueda puntual después de revisar si faltan evidencias. Se mantiene dentro del límite de páginas.',
    start: 'Iniciar investigación', cancel: 'Cancelar', cancelled: 'Cancelado', cancelledText: 'Investigación cancelada. No se buscó nada.',
    needOne: 'Conserva al menos una pregunta.'
  },
  fr: {
    title: 'Plan à valider', intro: 'Rien n’est recherché avant que vous appuyiez sur Démarrer. Modifiez ou retirez ce que vous voulez.',
    questions: 'Ce que Lumen va chercher', add: 'Ajouter une question', remove: 'Retirer', placeholder: 'Une question ou une recherche',
    pages: 'Nombre total de pages à lire', output: 'Vous recevez un rapport sourcé avec un PDF à télécharger. Lumen ne lit que des pages web publiques.',
    adaptive: 'Vérification adaptative des preuves', adaptiveOn: 'Activée', adaptiveOff: 'Désactivée', adaptiveHint: 'Si elle est activée, Lumen peut effectuer une recherche ciblée après avoir repéré un manque de preuves. La limite de pages reste respectée.',
    start: 'Lancer la recherche', cancel: 'Annuler', cancelled: 'Annulé', cancelledText: 'Recherche annulée. Rien n’a été recherché.',
    needOne: 'Gardez au moins une question.'
  },
  de: {
    title: 'Plan zur Freigabe', intro: 'Es wird nichts gesucht, bevor du auf Start drückst. Bearbeite oder entferne, was du willst.',
    questions: 'Wonach Lumen sucht', add: 'Frage hinzufügen', remove: 'Entfernen', placeholder: 'Eine Frage oder Suche',
    pages: 'Seiten insgesamt', output: 'Du erhältst einen Bericht mit Quellen und ein PDF zum Download. Lumen liest nur öffentliche Webseiten.',
    adaptive: 'Adaptive Evidenzprüfung', adaptiveOn: 'An', adaptiveOff: 'Aus', adaptiveHint: 'Wenn aktiv, kann Lumen nach der Prüfung auf Beleglücken eine gezielte Folgesuche ausführen. Das Seitenlimit bleibt bestehen.',
    start: 'Recherche starten', cancel: 'Abbrechen', cancelled: 'Abgebrochen', cancelledText: 'Recherche abgebrochen. Es wurde nichts gesucht.',
    needOne: 'Behalte mindestens eine Frage.'
  },
  ja: {
    title: '承認が必要なプラン', intro: '開始を押すまで何も検索しません。内容は自由に編集・削除できます。',
    questions: 'Lumenが調べること', add: '質問を追加', remove: '削除', placeholder: '質問または検索語',
    pages: '合計ページ数', output: '出典付きレポートとダウンロード可能なPDFを作成します。Lumenは公開ウェブページのみを読みます。',
    adaptive: '証拠の追加確認', adaptiveOn: 'オン', adaptiveOff: 'オフ', adaptiveHint: 'オンにすると、証拠の不足を確認した後、Lumenが対象を絞った追加検索を1回行うことがあります。ページ数の上限は変わりません。',
    start: 'リサーチを開始', cancel: 'キャンセル', cancelled: 'キャンセル済み', cancelledText: 'リサーチをキャンセルしました。何も検索していません。',
    needOne: '質問を1つ以上残してください。'
  },
  it: {
    title: 'Piano da approvare', intro: 'Non viene cercato nulla finché non premi Avvia. Modifica o rimuovi ciò che vuoi.',
    questions: 'Cosa cercherà Lumen', add: 'Aggiungi una domanda', remove: 'Rimuovi', placeholder: 'Una domanda o una ricerca',
    pages: 'Pagine totali da leggere', output: 'Ricevi un report con fonti e un PDF scaricabile. Lumen legge solo pagine web pubbliche.',
    adaptive: 'Verifica adattiva delle prove', adaptiveOn: 'Attiva', adaptiveOff: 'Disattivata', adaptiveHint: 'Se attiva, Lumen può fare una ricerca mirata dopo aver verificato eventuali lacune nelle prove. Il limite di pagine resta invariato.',
    start: 'Avvia la ricerca', cancel: 'Annulla', cancelled: 'Annullato', cancelledText: 'Ricerca annullata. Non è stato cercato nulla.',
    needOne: 'Mantieni almeno una domanda.'
  }
};

export const planLabels = (language) => LABELS[String(language || 'en').slice(0, 2)] || LABELS.en;

// A task plan the user reviews before Lumen searches anything. Edits stay local until Start.
export default function PlanCard({ plan, language, onStart, onCancel }) {
  const labels = planLabels(language);
  const [questions, setQuestions] = useState(plan.questions);
  const [maxPages, setMaxPages] = useState(plan.maxPages);
  const [adaptiveFollowUp, setAdaptiveFollowUp] = useState(plan.adaptiveFollowUp !== false);
  const usable = questions.filter((question) => question.trim().length >= 3);

  const update = (index, value) => setQuestions((current) => current.map((item, i) => (i === index ? value : item)));
  const remove = (index) => setQuestions((current) => current.filter((_, i) => i !== index));
  const add = () => setQuestions((current) => (current.length < PLAN_LIMITS.maxQuestions ? [...current, ''] : current));
  const start = () => {
    if (usable.length === 0) return;
    onStart(sanitizePlan({ topic: plan.topic, questions: usable, maxPages, adaptiveFollowUp }, plan.topic));
  };

  return (
    <section className="plan-card" aria-label={labels.title}>
      <header className="plan-card-head">
        <span className="plan-card-title">{labels.title}</span>
        {plan.topic && <span className="plan-card-topic" title={plan.topic}>{plan.topic}</span>}
      </header>
      <p className="plan-card-intro">{labels.intro}</p>

      <div className="plan-card-label">{labels.questions}</div>
      <ol className="plan-card-questions">
        {questions.map((question, index) => (
          <li key={index} className="plan-card-question">
            <input
              type="text"
              value={question}
              maxLength={PLAN_LIMITS.maxQuestionChars}
              placeholder={labels.placeholder}
              aria-label={`${labels.questions} ${index + 1}`}
              onChange={(event) => update(index, event.target.value)}
            />
            <button type="button" className="plan-card-icon-btn" onClick={() => remove(index)} aria-label={labels.remove} title={labels.remove}>×</button>
          </li>
        ))}
      </ol>
      {questions.length < PLAN_LIMITS.maxQuestions && (
        <button type="button" className="plan-card-link-btn" onClick={add}>+ {labels.add}</button>
      )}
      {usable.length === 0 && <p className="plan-card-warning" role="alert">{labels.needOne}</p>}

      <label className="plan-card-pages">
        <span>{labels.pages}</span>
        <input
          type="range"
          min={PLAN_LIMITS.minPages}
          max={PLAN_LIMITS.maxPages}
          value={maxPages}
          onChange={(event) => setMaxPages(Number(event.target.value))}
        />
        <span className="plan-card-pages-value">{maxPages}</span>
      </label>
      <div className="plan-card-adaptive-row">
        <button
          type="button"
          className={`plan-card-adaptive-pill${adaptiveFollowUp ? ' is-on' : ''}`}
          aria-pressed={adaptiveFollowUp}
          onClick={() => setAdaptiveFollowUp((enabled) => !enabled)}
        >
          <span className="plan-card-adaptive-dot" aria-hidden="true" />
          <span>{labels.adaptive}</span>
          <span className="plan-card-adaptive-state">{adaptiveFollowUp ? labels.adaptiveOn : labels.adaptiveOff}</span>
        </button>
        <p className="plan-card-adaptive-hint">{labels.adaptiveHint}</p>
      </div>
      <p className="plan-card-note">{labels.output}</p>

      <div className="plan-card-actions">
        <button type="button" className="plan-card-start" onClick={start} disabled={usable.length === 0}>{labels.start}</button>
        <button type="button" className="plan-card-cancel" onClick={onCancel}>{labels.cancel}</button>
      </div>
    </section>
  );
}
