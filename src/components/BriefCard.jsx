import React, { useState } from 'react';
import { BRIEF_LIMITS, sanitizeBrief } from '../../services/pageBrief.js';

const LABELS = {
  en: {
    title: 'Design brief for your approval', intro: 'Nothing is written until you press Build. Change anything you like.',
    pageTitle: 'Page title', mood: 'Mood and style', palette: 'Colours (first is the background)', features: 'What it will include',
    add: 'Add an element', addColor: 'Add a colour', remove: 'Remove', placeholder: 'An element or interaction',
    note: 'The page is one self-contained file that runs in a sandbox: no network, no outside scripts.',
    build: 'Build page', skip: 'Skip brief', cancel: 'Cancel', cancelledText: 'Page cancelled. Nothing was written.',
    needOne: 'Keep at least one element.'
  },
  es: {
    title: 'Boceto de diseño para tu aprobación', intro: 'No se escribe nada hasta que pulses Crear. Cambia lo que quieras.',
    pageTitle: 'Título de la página', mood: 'Ambiente y estilo', palette: 'Colores (el primero es el fondo)', features: 'Qué incluirá',
    add: 'Añadir un elemento', addColor: 'Añadir un color', remove: 'Quitar', placeholder: 'Un elemento o interacción',
    note: 'La página es un solo archivo que se ejecuta en un entorno aislado: sin red ni scripts externos.',
    build: 'Crear página', skip: 'Omitir boceto', cancel: 'Cancelar', cancelledText: 'Página cancelada. No se escribió nada.',
    needOne: 'Conserva al menos un elemento.'
  },
  fr: {
    title: 'Brief de design à valider', intro: 'Rien n’est écrit avant que vous appuyiez sur Créer. Modifiez ce que vous voulez.',
    pageTitle: 'Titre de la page', mood: 'Ambiance et style', palette: 'Couleurs (la première est le fond)', features: 'Ce qu’elle contiendra',
    add: 'Ajouter un élément', addColor: 'Ajouter une couleur', remove: 'Retirer', placeholder: 'Un élément ou une interaction',
    note: 'La page est un seul fichier exécuté dans un bac à sable : pas de réseau, pas de scripts externes.',
    build: 'Créer la page', skip: 'Passer le brief', cancel: 'Annuler', cancelledText: 'Page annulée. Rien n’a été écrit.',
    needOne: 'Gardez au moins un élément.'
  },
  de: {
    title: 'Design-Briefing zur Freigabe', intro: 'Es wird nichts geschrieben, bevor du auf Erstellen drückst. Ändere, was du willst.',
    pageTitle: 'Titel der Seite', mood: 'Stimmung und Stil', palette: 'Farben (die erste ist der Hintergrund)', features: 'Was enthalten sein wird',
    add: 'Element hinzufügen', addColor: 'Farbe hinzufügen', remove: 'Entfernen', placeholder: 'Ein Element oder eine Interaktion',
    note: 'Die Seite ist eine einzelne Datei in einer Sandbox: kein Netzwerk, keine externen Skripte.',
    build: 'Seite erstellen', skip: 'Briefing überspringen', cancel: 'Abbrechen', cancelledText: 'Seite abgebrochen. Es wurde nichts geschrieben.',
    needOne: 'Behalte mindestens ein Element.'
  },
  ja: {
    title: '承認が必要なデザインブリーフ', intro: '作成を押すまで何も書きません。内容は自由に変更できます。',
    pageTitle: 'ページのタイトル', mood: '雰囲気とスタイル', palette: '色（最初の色が背景）', features: '含まれる要素',
    add: '要素を追加', addColor: '色を追加', remove: '削除', placeholder: '要素またはインタラクション',
    note: 'ページはサンドボックスで動く単一ファイルです。ネットワークや外部スクリプトは使えません。',
    build: 'ページを作成', skip: 'ブリーフを省略', cancel: 'キャンセル', cancelledText: 'ページ作成をキャンセルしました。何も書いていません。',
    needOne: '要素を1つ以上残してください。'
  },
  it: {
    title: 'Brief di design da approvare', intro: 'Non viene scritto nulla finché non premi Crea. Modifica ciò che vuoi.',
    pageTitle: 'Titolo della pagina', mood: 'Atmosfera e stile', palette: 'Colori (il primo è lo sfondo)', features: 'Cosa includerà',
    add: 'Aggiungi un elemento', addColor: 'Aggiungi un colore', remove: 'Rimuovi', placeholder: 'Un elemento o un’interazione',
    note: 'La pagina è un unico file eseguito in una sandbox: niente rete, niente script esterni.',
    build: 'Crea la pagina', skip: 'Salta il brief', cancel: 'Annulla', cancelledText: 'Pagina annullata. Non è stato scritto nulla.',
    needOne: 'Mantieni almeno un elemento.'
  }
};

export const briefLabels = (language) => LABELS[String(language || 'en').slice(0, 2)] || LABELS.en;

const paletteGradient = (colors) => (colors.length > 1 ? `linear-gradient(90deg, ${colors.join(', ')})` : colors[0] || 'transparent');

// A design brief the user reviews before Lumen writes a page. Edits stay local until Build.
export default function BriefCard({ brief, language, onBuild, onSkip, onCancel }) {
  const labels = briefLabels(language);
  const [title, setTitle] = useState(brief.title);
  const [mood, setMood] = useState(brief.mood);
  const [palette, setPalette] = useState(brief.palette);
  const [features, setFeatures] = useState(brief.features);
  const usable = features.filter((feature) => feature.trim().length >= 3);

  const setAt = (setter) => (index, value) => setter((current) => current.map((item, i) => (i === index ? value : item)));
  const removeAt = (setter) => (index) => setter((current) => current.filter((_, i) => i !== index));
  const build = () => {
    if (usable.length === 0) return;
    onBuild(sanitizeBrief({ title, mood, palette, features: usable }));
  };

  return (
    <section className="plan-card brief-card" aria-label={labels.title}>
      <div className="brief-card-strip" style={{ background: paletteGradient(palette) }} aria-hidden="true" />
      <header className="plan-card-head">
        <span className="plan-card-title">{labels.title}</span>
      </header>
      <p className="plan-card-intro">{labels.intro}</p>

      <label className="brief-card-field">
        <span className="plan-card-label">{labels.pageTitle}</span>
        <input type="text" value={title} maxLength={BRIEF_LIMITS.maxTitleChars} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="brief-card-field">
        <span className="plan-card-label">{labels.mood}</span>
        <input type="text" value={mood} maxLength={BRIEF_LIMITS.maxMoodChars} onChange={(event) => setMood(event.target.value)} />
      </label>

      <div className="plan-card-label">{labels.palette}</div>
      <div className="brief-card-palette">
        {palette.map((color, index) => (
          <span key={index} className="brief-card-swatch">
            <input
              type="color"
              value={color}
              aria-label={`${labels.palette} ${index + 1}`}
              onChange={(event) => setAt(setPalette)(index, event.target.value)}
            />
            {palette.length > 1 && (
              <button type="button" className="brief-card-swatch-remove" onClick={() => removeAt(setPalette)(index)} aria-label={labels.remove} title={labels.remove}>×</button>
            )}
          </span>
        ))}
        {palette.length < BRIEF_LIMITS.maxColors && (
          <button type="button" className="brief-card-swatch-add" onClick={() => setPalette((current) => [...current, '#8b5cf6'])} aria-label={labels.addColor} title={labels.addColor}>+</button>
        )}
      </div>

      <div className="plan-card-label">{labels.features}</div>
      <ol className="plan-card-questions">
        {features.map((feature, index) => (
          <li key={index} className="plan-card-question">
            <input
              type="text"
              value={feature}
              maxLength={BRIEF_LIMITS.maxFeatureChars}
              placeholder={labels.placeholder}
              aria-label={`${labels.features} ${index + 1}`}
              onChange={(event) => setAt(setFeatures)(index, event.target.value)}
            />
            <button type="button" className="plan-card-icon-btn" onClick={() => removeAt(setFeatures)(index)} aria-label={labels.remove} title={labels.remove}>×</button>
          </li>
        ))}
      </ol>
      {features.length < BRIEF_LIMITS.maxFeatures && (
        <button type="button" className="plan-card-link-btn" onClick={() => setFeatures((current) => [...current, ''])}>+ {labels.add}</button>
      )}
      {usable.length === 0 && <p className="plan-card-warning" role="alert">{labels.needOne}</p>}
      <p className="plan-card-note">{labels.note}</p>

      <div className="plan-card-actions">
        <button type="button" className="plan-card-start" onClick={build} disabled={usable.length === 0}>{labels.build}</button>
        <button type="button" className="plan-card-cancel" onClick={onSkip}>{labels.skip}</button>
        <button type="button" className="plan-card-cancel" onClick={onCancel}>{labels.cancel}</button>
      </div>
    </section>
  );
}
