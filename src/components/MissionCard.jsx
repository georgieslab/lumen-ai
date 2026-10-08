import React, { useEffect, useState } from 'react';
import { elapsedLabel } from '../services/mission';

const LABELS = {
  en: {
    brief: 'Design brief approved', build: 'Writing the page',
    title: 'What Lumen is doing', done: 'How Lumen did this', stopped: 'Stopped', failed: 'Stopped by an error', took: 'took',
    search: 'Searching the web', reading: 'Reading sources', synthesis: 'Writing the report', pdf: 'Building the PDF',
    searches: 'searches', unavailable: 'unavailable',
    followUpStatus: { checking: 'Checking evidence gaps', searching: 'Running one follow-up search', reading: 'Reading the follow-up source', complete: 'Follow-up check complete', no_gaps: 'Evidence is sufficient', no_source: 'No additional source found', unavailable: 'Evidence check unavailable', search_failed: 'Follow-up search failed', disabled: 'Not requested' },
    followUpQueryLabel: 'Follow-up',
    live_web_search: 'Web search', browse_web_page: 'Read a page', call_direct_api: 'Fetched data', get_live_weather: 'Checked weather',
    get_crypto_and_market_prices: 'Checked prices', create_pdf_document: 'Created a PDF', other: 'Used a tool',
    sources: 'sources', pages: 'pages read', skipped: 'not run'
  },
  es: {
    brief: 'Boceto de diseño aprobado', build: 'Escribiendo la página',
    title: 'Lo que hace Lumen', done: 'Cómo lo hizo Lumen', stopped: 'Detenido', failed: 'Detenido por un error', took: 'tardó',
    search: 'Buscando en la web', reading: 'Leyendo fuentes', synthesis: 'Redactando el informe', pdf: 'Creando el PDF',
    searches: 'búsquedas', unavailable: 'no disponibles',
    followUpStatus: { checking: 'Comprobando lagunas de evidencia', searching: 'Realizando una búsqueda adicional', reading: 'Leyendo la fuente adicional', complete: 'Comprobación adicional completada', no_gaps: 'La evidencia es suficiente', no_source: 'No se encontró otra fuente', unavailable: 'Comprobación de evidencia no disponible', search_failed: 'Falló la búsqueda adicional', disabled: 'No solicitada' },
    followUpQueryLabel: 'Búsqueda adicional',
    live_web_search: 'Búsqueda web', browse_web_page: 'Leyó una página', call_direct_api: 'Obtuvo datos', get_live_weather: 'Consultó el clima',
    get_crypto_and_market_prices: 'Consultó precios', create_pdf_document: 'Creó un PDF', other: 'Usó una herramienta',
    sources: 'fuentes', pages: 'páginas leídas', skipped: 'no ejecutado'
  },
  fr: {
    brief: 'Brief de design validé', build: 'Écriture de la page',
    title: 'Ce que fait Lumen', done: 'Comment Lumen a procédé', stopped: 'Arrêté', failed: 'Arrêté par une erreur', took: 'durée',
    search: 'Recherche sur le web', reading: 'Lecture des sources', synthesis: 'Rédaction du rapport', pdf: 'Création du PDF',
    searches: 'recherches', unavailable: 'indisponibles',
    followUpStatus: { checking: 'Vérification des lacunes de preuves', searching: 'Recherche complémentaire en cours', reading: 'Lecture de la source complémentaire', complete: 'Vérification complémentaire terminée', no_gaps: 'Les preuves sont suffisantes', no_source: 'Aucune autre source trouvée', unavailable: 'Vérification des preuves indisponible', search_failed: 'Échec de la recherche complémentaire', disabled: 'Non demandée' },
    followUpQueryLabel: 'Complément',
    live_web_search: 'Recherche web', browse_web_page: 'Page lue', call_direct_api: 'Données récupérées', get_live_weather: 'Météo consultée',
    get_crypto_and_market_prices: 'Prix consultés', create_pdf_document: 'PDF créé', other: 'Outil utilisé',
    sources: 'sources', pages: 'pages lues', skipped: 'non exécuté'
  },
  de: {
    brief: 'Design-Briefing freigegeben', build: 'Seite wird geschrieben',
    title: 'Was Lumen gerade tut', done: 'So ist Lumen vorgegangen', stopped: 'Gestoppt', failed: 'Wegen eines Fehlers gestoppt', took: 'Dauer',
    search: 'Websuche', reading: 'Quellen lesen', synthesis: 'Bericht schreiben', pdf: 'PDF erstellen',
    searches: 'Suchanfragen', unavailable: 'nicht verfügbar',
    followUpStatus: { checking: 'Prüft Beleglücken', searching: 'Führt eine Folgesuche aus', reading: 'Liest die zusätzliche Quelle', complete: 'Zusätzliche Prüfung abgeschlossen', no_gaps: 'Belege sind ausreichend', no_source: 'Keine weitere Quelle gefunden', unavailable: 'Belegprüfung nicht verfügbar', search_failed: 'Folgesuche fehlgeschlagen', disabled: 'Nicht angefordert' },
    followUpQueryLabel: 'Folgesuche',
    live_web_search: 'Websuche', browse_web_page: 'Seite gelesen', call_direct_api: 'Daten abgerufen', get_live_weather: 'Wetter geprüft',
    get_crypto_and_market_prices: 'Preise geprüft', create_pdf_document: 'PDF erstellt', other: 'Werkzeug genutzt',
    sources: 'Quellen', pages: 'Seiten gelesen', skipped: 'nicht ausgeführt'
  },
  ja: {
    brief: 'デザインブリーフを承認済み', build: 'ページを作成中',
    title: 'Lumenの作業状況', done: 'Lumenの作業内容', stopped: '停止しました', failed: 'エラーで停止しました', took: '所要時間',
    search: 'ウェブを検索中', reading: '情報源を読み込み中', synthesis: 'レポートを作成中', pdf: 'PDFを作成中',
    searches: '件の検索', unavailable: '件取得不可',
    followUpStatus: { checking: '証拠の不足を確認中', searching: '追加検索を実行中', reading: '追加ソースを読込中', complete: '追加確認が完了', no_gaps: '証拠は十分です', no_source: '追加ソースなし', unavailable: '証拠確認を利用できません', search_failed: '追加検索に失敗', disabled: '未指定' },
    followUpQueryLabel: '追加検索',
    live_web_search: 'ウェブ検索', browse_web_page: 'ページを読みました', call_direct_api: 'データを取得しました', get_live_weather: '天気を確認しました',
    get_crypto_and_market_prices: '価格を確認しました', create_pdf_document: 'PDFを作成しました', other: 'ツールを使用しました',
    sources: '件の情報源', pages: 'ページ読込済み', skipped: '未実行'
  },
  it: {
    brief: 'Brief di design approvato', build: 'Scrittura della pagina',
    title: 'Cosa sta facendo Lumen', done: 'Come ha lavorato Lumen', stopped: 'Interrotto', failed: 'Interrotto da un errore', took: 'durata',
    search: 'Ricerca sul web', reading: 'Lettura delle fonti', synthesis: 'Stesura del report', pdf: 'Creazione del PDF',
    searches: 'ricerche', unavailable: 'non disponibili',
    followUpStatus: { checking: 'Verifica le lacune nelle prove', searching: 'Esegue una ricerca aggiuntiva', reading: 'Legge la fonte aggiuntiva', complete: 'Verifica aggiuntiva completata', no_gaps: 'Le prove sono sufficienti', no_source: 'Nessun’altra fonte trovata', unavailable: 'Verifica delle prove non disponibile', search_failed: 'Ricerca aggiuntiva non riuscita', disabled: 'Non richiesta' },
    followUpQueryLabel: 'Ricerca aggiuntiva',
    live_web_search: 'Ricerca web', browse_web_page: 'Pagina letta', call_direct_api: 'Dati recuperati', get_live_weather: 'Meteo controllato',
    get_crypto_and_market_prices: 'Prezzi controllati', create_pdf_document: 'PDF creato', other: 'Strumento usato',
    sources: 'fonti', pages: 'pagine lette', skipped: 'non eseguito'
  }
};

const STOPPED_TEXT = {
  en: 'Stopped. Ask again whenever you like.',
  es: 'Detenido. Vuelve a preguntar cuando quieras.',
  fr: 'Arrêté. Reposez la question quand vous voulez.',
  de: 'Gestoppt. Frag einfach noch einmal, wann du magst.',
  ja: '停止しました。いつでももう一度お尋ねください。',
  it: 'Interrotto. Chiedi di nuovo quando vuoi.'
};

export const stoppedMessage = (language) => STOPPED_TEXT[String(language || 'en').slice(0, 2)] || STOPPED_TEXT.en;

const STATE_ICON = { done: '✓', active: '', pending: '', stopped: '■', failed: '!', skipped: '–' };

export function writingLabel(language) {
  return labelsFor(language).build;
}

function labelsFor(language) {
  return LABELS[String(language || 'en').slice(0, 2)] || LABELS.en;
}

function stepLabel(step, labels) {
  if (step.kind === 'stage') return labels[step.id] || step.id;
  return labels[step.tool] || labels.other;
}

// The short detail beside a step: the search query, a hostname, a city. Never raw tool output.
function stepDetail(step, labels) {
  const params = step.params || {};
  const parts = [params.query, params.host, params.city, params.asset, params.title].filter(Boolean);
  const meta = step.meta || {};
  if (Number.isFinite(meta.sources)) parts.push(`${meta.sources} ${labels.sources}`);
  if (Number.isFinite(meta.pagesRead)) parts.push(`${meta.pagesRead} ${labels.pages}`);
  if (Number.isFinite(meta.searchesTotal)) parts.push(`${meta.searchesCompleted || 0}/${meta.searchesTotal} ${labels.searches}`);
  if (meta.pagesFailed > 0) parts.push(`${meta.pagesFailed} ${labels.unavailable}`);
  const followUpStatusLabel = labels.followUpStatus?.[meta.followUpStatus] ||
    (meta.followUpStatus === 'source_unavailable' ? labels.unavailable : null);
  if (followUpStatusLabel) parts.push(followUpStatusLabel);
  if (meta.followUpQuery) parts.push(`${labels.followUpQueryLabel}: ${String(meta.followUpQuery).slice(0, 100)}`);
  return parts.join(' · ');
}

function useTicker(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function StepList({ steps, labels }) {
  return (
    <ol className="mission-steps">
      {steps.map((step) => {
        const detail = stepDetail(step, labels);
        return (
          <li key={step.id} className={`mission-step is-${step.state}`}>
            <span className="mission-step-mark" aria-hidden="true">{STATE_ICON[step.state] || ''}</span>
            <span className="mission-step-text">
              <span className="mission-step-label">{stepLabel(step, labels)}</span>
              {detail && <span className="mission-step-detail" title={detail}>{detail}</span>}
            </span>
            {step.state === 'skipped' && <span className="mission-step-note">{labels.skipped}</span>}
          </li>
        );
      })}
    </ol>
  );
}

// Live view of a running task. Stopping is done from the answer bubble (or Escape), so this is display only.
export function MissionCard({ mission, language }) {
  const running = mission?.status === 'running';
  const now = useTicker(running);
  if (!mission || mission.steps.length === 0) return null;
  const labels = labelsFor(language);
  return (
    <div className="mission-card" role="status" aria-live="polite" aria-label={labels.title}>
      <div className="mission-card-head">
        <span className="research-progress-beacon" />
        <span className="mission-card-title">{labels.title}</span>
        <span className="mission-card-time">{elapsedLabel(mission.startedAt, mission.endedAt, now)}</span>
      </div>
      <StepList steps={mission.steps} labels={labels} />
    </div>
  );
}

// What stays with a finished reply: collapsed, so it never competes with the answer.
export function MissionActivity({ activity, language }) {
  if (!activity || !Array.isArray(activity.steps) || activity.steps.length === 0) return null;
  const labels = labelsFor(language);
  const seconds = Math.max(0, Math.round((activity.durationMs || 0) / 1000));
  const summary = activity.status === 'stopped' ? labels.stopped : activity.status === 'failed' ? labels.failed : labels.done;
  return (
    <details className={`mission-activity is-${activity.status}`}>
      <summary>
        <span>{summary}</span>
        <span className="mission-activity-meta">{activity.steps.length} · {labels.took} {seconds}s</span>
      </summary>
      <StepList steps={activity.steps} labels={labels} />
    </details>
  );
}

export default MissionCard;
