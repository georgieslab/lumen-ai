export const LANDING_LANGUAGES = ['en', 'de'];

const en = {
  htmlLang: 'en',
  skip: 'Skip to content',
  homeLabel: 'Lumen AI home',
  navLabel: 'Main navigation',
  nav: { capabilities: 'Capabilities', experience: 'The experience', faq: 'FAQ' },
  openCopilot: 'Open the copilot',
  openLumen: 'Open Lumen',
  menuClose: 'Close navigation menu',
  menuOpen: 'Open navigation menu',
  menuCloseShort: 'Close',
  menuOpenShort: 'Menu',
  langLabel: 'Language',
  hero: {
    eyebrow: 'A NEW WAY TO THINK WITH AI',
    title1: 'Your thoughts,',
    title2: 'in a ',
    title3: 'new light.',
    intro: 'Meet Lumen: an ambient AI companion for real conversations, curious questions, and the things you want to understand.',
    primary: 'Talk with Lumen',
    quiet: 'Discover what’s possible',
    note: 'Voice, vision, and research—in one thoughtful space.',
    coverAlt: 'A luminous Lumen orb, woven from cyan, violet, and rose light.',
    cardVoiceTitle: 'Always in the conversation',
    cardVoiceSub: 'Voice · text · your pace',
    cardVisionTitle: 'Ideas, brought into focus',
    cardVisionSub: 'Look closer with Lumen',
    caption: 'A little more light on what’s next',
    scroll: 'SCROLL TO EXPLORE',
    scrollLabel: 'Scroll to explore Lumen'
  },
  signal: {
    aria: 'Lumen at a glance',
    label: 'ONE COPILOT, MORE WAYS TO THINK',
    voice: 'VOICE',
    vision: 'VISION',
    research: 'RESEARCH',
    pace: 'YOUR PACE'
  },
  capabilities: {
    kicker: 'A COMPANION THAT KEEPS UP',
    title1: 'More than an answer.',
    title2: 'A space to explore.',
    intro: 'Start with a thought, a picture, or a question. Lumen brings the right kind of attention to the moment.',
    topline: 'LUMEN CAPABILITY'
  },
  features: [
    {
      title: 'Say what you’re thinking.',
      detail: 'Have a spoken conversation, or type when that feels more natural. Lumen is ready to follow your train of thought.',
      action: 'Explore voice'
    },
    {
      title: 'Let the details speak.',
      detail: 'Bring an image, a PDF, or a page you choose to share. Ask questions with the context already in view.',
      action: 'Explore vision'
    },
    {
      title: 'Turn curiosity into clarity.',
      detail: 'Research public web sources, get live information, and create a report you can take with you.',
      action: 'Explore research'
    },
    {
      title: 'Make the space your own.',
      detail: 'Choose a voice, language, and response style. Review, edit, or pause saved memories whenever you like.',
      action: 'Meet your copilot'
    }
  ],
  art: {
    voice: 'Voice',
    voiceName: 'Joanna',
    replyStyle: 'Reply style',
    replyStyleName: 'Thoughtful',
    memoryControls: 'Memory controls',
    research: 'RESEARCH',
    conversation: 'A conversation, at your pace',
    yourContext: 'Your context',
    imageOrPdf: 'Image or PDF',
    askAbout: 'ASK ABOUT WHAT YOU SEE',
    researchNotes: 'RESEARCH NOTES',
    exploreQuestion: 'Explore a question',
    source: 'SOURCE',
    report: 'Research report',
    reportSub: 'Ready to take with you'
  },
  experience: {
    kicker: 'ONE SPACE, MANY STARTING POINTS',
    title1: 'However you arrive,',
    title2: 'there’s room to go deeper.',
    intro: 'Choose a path to preview how Lumen can meet you there.',
    pickerLabel: 'Choose a Lumen capability to preview',
    note: 'Move between voice, vision, and research as your question takes shape.',
    previewSuffix: 'preview',
    exampleLabel: 'AN EXAMPLE QUESTION',
    disclaimer: 'A glimpse of what you can explore with Lumen'
  },
  modes: [
    {
      label: 'Talk it out',
      eyebrow: 'VOICE CONVERSATION',
      title: 'Think out loud.',
      detail: 'Speak naturally, hear Lumen respond, and keep the thread going without losing your place.',
      question: '“Can we think this through together?”'
    },
    {
      label: 'Show and tell',
      eyebrow: 'IMAGES AND DOCUMENTS',
      title: 'Bring the context.',
      detail: 'Share an image or PDF and ask Lumen to help you understand what you are looking at.',
      question: '“What should I notice in this?”'
    },
    {
      label: 'Go deeper',
      eyebrow: 'WEB RESEARCH',
      title: 'Follow your curiosity.',
      detail: 'Explore a topic with sourced web research, then turn the findings into a downloadable report.',
      question: '“Can you research this and make me a report?”'
    }
  ],
  sphere: {
    kicker: 'MEET THE SPHERE',
    title1: 'A presence, not a chat box.',
    title2: 'Tap it. It listens.',
    body: 'The living sphere is how you talk to Lumen. It glows while it listens, ripples while it thinks, and pulses as it speaks. Tap it to try the states.',
    stateLabel: 'STATE',
    states: { idle: 'Idle', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking' },
    labels: { tapToConverse: 'Tap to converse', listening: 'Listening…', reflecting: 'Reflecting…', speaking: 'Speaking…', taskComplete: 'Done', inspectingDoc: 'Reading…', inspectingImg: 'Looking…' },
    cta: 'Try it live'
  },
  personal: {
    kicker: 'BUILT AROUND YOU',
    title1: 'Your voice.',
    title2: 'Your way of thinking.',
    body: 'Choose how Lumen speaks and responds. Keep saved memories useful, manageable, and on your terms.',
    link: 'Make it yours',
    head: 'YOUR LUMEN',
    voiceLabel: 'VOICE',
    voiceText: 'Choose the voice that feels right',
    styleLabel: 'RESPONSE STYLE',
    styleText: 'Shape how Lumen replies',
    memoryTitle: 'Memory, with your say',
    memorySub: 'Review, edit, or pause anytime',
    foot: 'YOUR PREFERENCES, YOURS TO CHANGE'
  },
  faq: {
    kicker: 'GOOD TO KNOW',
    title1: 'A few things',
    title2: 'you might wonder.',
    intro: 'Still curious? Start a conversation and see where it takes you.',
    link: 'Ask Lumen',
    items: [
      {
        question: 'What is Lumen?',
        answer: 'Lumen is a voice- and vision-enabled AI copilot for conversation, image and PDF analysis, web research, and live information.'
      },
      {
        question: 'How do I use it?',
        answer: 'Open the copilot and ask by voice or text. You can attach an image or PDF, or ask Lumen to research a topic on the web.'
      },
      {
        question: 'Can I control what Lumen remembers?',
        answer: 'Yes. You can review, edit, or delete saved memories, and automatic memory can be paused from the account controls.'
      },
      {
        question: 'Does Lumen work offline?',
        answer: 'AI conversations and live-data features need an internet connection.'
      }
    ]
  },
  final: {
    kicker: 'THE NEXT QUESTION IS YOURS',
    title1: 'Let’s see where',
    title2: 'your curiosity goes.',
    body: 'A thought, a question, a whole new perspective. Start anywhere.',
    cta: 'Talk with Lumen'
  },
  footer: {
    tagline: 'Ambient intelligence, with room to think.',
    github: 'GitHub'
  }
};

const de = {
  htmlLang: 'de',
  skip: 'Zum Inhalt springen',
  homeLabel: 'Lumen AI Startseite',
  navLabel: 'Hauptnavigation',
  nav: { capabilities: 'Funktionen', experience: 'Das Erlebnis', faq: 'FAQ' },
  openCopilot: 'Copilot öffnen',
  openLumen: 'Lumen öffnen',
  menuClose: 'Navigationsmenü schließen',
  menuOpen: 'Navigationsmenü öffnen',
  menuCloseShort: 'Schließen',
  menuOpenShort: 'Menü',
  langLabel: 'Sprache',
  hero: {
    eyebrow: 'EINE NEUE ART, MIT KI ZU DENKEN',
    title1: 'Deine Gedanken,',
    title2: 'in ',
    title3: 'neuem Licht.',
    intro: 'Lerne Lumen kennen: einen ambienten KI-Begleiter für echte Gespräche, neugierige Fragen und alles, was du verstehen möchtest.',
    primary: 'Mit Lumen sprechen',
    quiet: 'Entdecke, was möglich ist',
    note: 'Sprache, Sehen und Recherche – in einem durchdachten Raum.',
    coverAlt: 'Eine leuchtende Lumen-Kugel, gewoben aus cyanfarbenem, violettem und rosafarbenem Licht.',
    cardVoiceTitle: 'Immer im Gespräch',
    cardVoiceSub: 'Sprache · Text · dein Tempo',
    cardVisionTitle: 'Ideen im Fokus',
    cardVisionSub: 'Schau genauer hin mit Lumen',
    caption: 'Ein bisschen mehr Licht auf das, was kommt',
    scroll: 'ZUM ENTDECKEN SCROLLEN',
    scrollLabel: 'Scrollen, um Lumen zu entdecken'
  },
  signal: {
    aria: 'Lumen auf einen Blick',
    label: 'EIN COPILOT, MEHR WEGE ZU DENKEN',
    voice: 'SPRACHE',
    vision: 'SEHEN',
    research: 'RECHERCHE',
    pace: 'DEIN TEMPO'
  },
  capabilities: {
    kicker: 'EIN BEGLEITER, DER MITHÄLT',
    title1: 'Mehr als eine Antwort.',
    title2: 'Ein Raum zum Entdecken.',
    intro: 'Beginne mit einem Gedanken, einem Bild oder einer Frage. Lumen schenkt dem Moment die passende Aufmerksamkeit.',
    topline: 'LUMEN-FUNKTION'
  },
  features: [
    {
      title: 'Sag, was du denkst.',
      detail: 'Führe ein Gespräch per Sprache oder tippe, wenn dir das lieber ist. Lumen folgt deinem Gedankengang.',
      action: 'Sprache entdecken'
    },
    {
      title: 'Lass die Details sprechen.',
      detail: 'Bring ein Bild, ein PDF oder eine Seite mit, die du teilen möchtest. Stelle Fragen, während der Kontext schon im Blick ist.',
      action: 'Sehen entdecken'
    },
    {
      title: 'Aus Neugier wird Klarheit.',
      detail: 'Recherchiere öffentliche Webquellen, erhalte aktuelle Informationen und erstelle einen Bericht zum Mitnehmen.',
      action: 'Recherche entdecken'
    },
    {
      title: 'Mach den Raum zu deinem.',
      detail: 'Wähle Stimme, Sprache und Antwortstil. Gespeicherte Erinnerungen kannst du jederzeit ansehen, bearbeiten oder pausieren.',
      action: 'Deinen Copilot kennenlernen'
    }
  ],
  art: {
    voice: 'Stimme',
    voiceName: 'Vicki',
    replyStyle: 'Antwortstil',
    replyStyleName: 'Nachdenklich',
    memoryControls: 'Erinnerungen verwalten',
    research: 'RECHERCHE',
    conversation: 'Ein Gespräch in deinem Tempo',
    yourContext: 'Dein Kontext',
    imageOrPdf: 'Bild oder PDF',
    askAbout: 'FRAG NACH DEM, WAS DU SIEHST',
    researchNotes: 'RECHERCHE-NOTIZEN',
    exploreQuestion: 'Eine Frage erkunden',
    source: 'QUELLE',
    report: 'Recherchebericht',
    reportSub: 'Bereit zum Mitnehmen'
  },
  experience: {
    kicker: 'EIN RAUM, VIELE STARTPUNKTE',
    title1: 'Wie auch immer du ankommst,',
    title2: 'es ist Platz, tiefer zu gehen.',
    intro: 'Wähle einen Weg und sieh dir an, wie Lumen dich dort abholt.',
    pickerLabel: 'Wähle eine Lumen-Funktion für die Vorschau',
    note: 'Wechsle zwischen Sprache, Sehen und Recherche, während deine Frage Gestalt annimmt.',
    previewSuffix: 'Vorschau',
    exampleLabel: 'EINE BEISPIELFRAGE',
    disclaimer: 'Ein Einblick, was du mit Lumen entdecken kannst'
  },
  modes: [
    {
      label: 'Ausreden lassen',
      eyebrow: 'SPRACHGESPRÄCH',
      title: 'Denk laut.',
      detail: 'Sprich ganz natürlich, höre Lumens Antwort und behalte den roten Faden, ohne den Überblick zu verlieren.',
      question: '„Können wir das gemeinsam durchdenken?“'
    },
    {
      label: 'Zeigen und erzählen',
      eyebrow: 'BILDER UND DOKUMENTE',
      title: 'Bring den Kontext mit.',
      detail: 'Teile ein Bild oder PDF und bitte Lumen, dir zu helfen zu verstehen, was du siehst.',
      question: '„Worauf sollte ich hier achten?“'
    },
    {
      label: 'Tiefer gehen',
      eyebrow: 'WEBRECHERCHE',
      title: 'Folge deiner Neugier.',
      detail: 'Erkunde ein Thema mit quellenbasierter Webrecherche und mach die Ergebnisse zu einem herunterladbaren Bericht.',
      question: '„Kannst du das recherchieren und mir einen Bericht erstellen?“'
    }
  ],
  sphere: {
    kicker: 'LERNE DIE KUGEL KENNEN',
    title1: 'Eine Präsenz, kein Chatfenster.',
    title2: 'Tippe sie an. Sie hört zu.',
    body: 'Die lebendige Kugel ist dein Weg zu Lumen. Sie leuchtet beim Zuhören, wogt beim Nachdenken und pulsiert beim Sprechen. Tippe sie an, um die Zustände auszuprobieren.',
    stateLabel: 'ZUSTAND',
    states: { idle: 'Bereit', listening: 'Zuhören', thinking: 'Nachdenken', speaking: 'Sprechen' },
    labels: { tapToConverse: 'Zum Sprechen tippen', listening: 'Höre zu…', reflecting: 'Denke nach…', speaking: 'Spreche…', taskComplete: 'Fertig', inspectingDoc: 'Lese…', inspectingImg: 'Schaue…' },
    cta: 'Live ausprobieren'
  },
  personal: {
    kicker: 'AUF DICH ZUGESCHNITTEN',
    title1: 'Deine Stimme.',
    title2: 'Deine Art zu denken.',
    body: 'Bestimme, wie Lumen spricht und antwortet. Gespeicherte Erinnerungen bleiben nützlich, überschaubar und in deiner Hand.',
    link: 'Mach es zu deinem',
    head: 'DEIN LUMEN',
    voiceLabel: 'STIMME',
    voiceText: 'Wähle die Stimme, die sich richtig anfühlt',
    styleLabel: 'ANTWORTSTIL',
    styleText: 'Gestalte, wie Lumen antwortet',
    memoryTitle: 'Erinnerung mit deinem Mitspracherecht',
    memorySub: 'Jederzeit ansehen, bearbeiten oder pausieren',
    foot: 'DEINE EINSTELLUNGEN, DEINE ENTSCHEIDUNG'
  },
  faq: {
    kicker: 'GUT ZU WISSEN',
    title1: 'Ein paar Dinge,',
    title2: 'die du dich fragen könntest.',
    intro: 'Noch neugierig? Starte ein Gespräch und schau, wohin es führt.',
    link: 'Lumen fragen',
    items: [
      {
        question: 'Was ist Lumen?',
        answer: 'Lumen ist ein KI-Copilot mit Sprach- und Bildverständnis für Gespräche, Bild- und PDF-Analyse, Webrecherche und aktuelle Informationen.'
      },
      {
        question: 'Wie nutze ich es?',
        answer: 'Öffne den Copilot und frage per Sprache oder Text. Du kannst ein Bild oder PDF anhängen oder Lumen bitten, ein Thema im Web zu recherchieren.'
      },
      {
        question: 'Kann ich steuern, woran sich Lumen erinnert?',
        answer: 'Ja. Du kannst gespeicherte Erinnerungen ansehen, bearbeiten oder löschen, und die automatische Erinnerung lässt sich in den Kontoeinstellungen pausieren.'
      },
      {
        question: 'Funktioniert Lumen offline?',
        answer: 'KI-Gespräche und Live-Daten-Funktionen benötigen eine Internetverbindung.'
      }
    ]
  },
  final: {
    kicker: 'DIE NÄCHSTE FRAGE GEHÖRT DIR',
    title1: 'Schauen wir, wohin',
    title2: 'deine Neugier führt.',
    body: 'Ein Gedanke, eine Frage, eine ganz neue Perspektive. Fang einfach an.',
    cta: 'Mit Lumen sprechen'
  },
  footer: {
    tagline: 'Ambiente Intelligenz mit Raum zum Denken.',
    github: 'GitHub'
  }
};

export const LANDING_COPY = { en, de };

const STORAGE_KEY = 'lumen_landing_lang';

export function detectLandingLanguage() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (LANDING_LANGUAGES.includes(saved)) return saved;
  } catch (_) {
    // Fall back to the browser language below.
  }
  const browser = (navigator.language || 'en').toLowerCase();
  return browser.startsWith('de') ? 'de' : 'en';
}

export function saveLandingLanguage(lang) {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch (_) {
    // Persistence is optional.
  }
}
