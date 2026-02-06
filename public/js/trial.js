// ===== Trial Mode - 1 Free Song Without Registration =====

// State
let pendingLyrics = null;
let pendingStyle = null;
let hasGeneratedSong = false;
let exampleInterval = null;
let currentExampleIndex = 0;
const GENERATION_ESTIMATE_SEC = 250;
let generationTimer = null;
let generationStartedAt = null;

// Wizard state
const WIZARD_STEPS = [
  { key: "language", label: "Sprache" },
  { key: "occasion", label: "Anlass" },
  { key: "recipient", label: "Für wen" },
  { key: "name", label: "Name" },
  { key: "details", label: "Details" },
  { key: "style", label: "Stil" },
];

let wizardData = { language: "", occasion: "", recipient: "", name: "", details: "", style: "" };
let currentStep = 0;

// ===== UI Localization =====
const UI_TEXT = {
  de: {
    wizardTitle: "Neuer Song",
    resetLabel: "Neu starten",
    steps: {
      language: "Sprache",
      occasion: "Anlass",
      recipient: "Für wen",
      name: "Name",
      details: "Details",
      style: "Stil",
    },
    titles: {
      language: "Welche Sprache soll der Song haben?",
      occasion: "Wähle den Anlass",
      recipient: "Für wen ist der Song?",
      name: "Wie heißt die Person?",
      details: "Persönliche Details",
      style: "Wähle den Musikstil",
    },
    descriptions: {
      language: "Wähle die Sprache für deinen Songtext.",
      occasion: "Für welchen Anlass soll der Song sein?",
      recipient: "Wer soll mit dem Song überrascht werden?",
      name: "Der Name wird im Song verwendet.",
      details: "Erzähle etwas über die Person oder den Anlass. Je mehr Details, desto persönlicher der Song. (Optional)",
      style: "Welcher Stil passt am besten?",
    },
    placeholders: {
      occasion: "Oder eigenen Anlass eingeben...",
      recipient: "Oder eigene Angabe eingeben...",
      name: "z.B. Maria, Tom, Mama...",
      details: "",
      style: "Oder eigenen Stil eingeben...",
      lyricsAi: "z.B. Mach den Chorus emotionaler...",
    },
    detailsExampleLabel: "💡 Beispiel:",
    nav: {
      back: "Zurück",
      next: "Weiter",
      generateLyrics: "Lyrics erstellen",
      stepIndicator: (step, total) => `Schritt ${step} von ${total}`,
    },
    lyricsGenerating: "Lyrics werden erstellt...",
    lyricsHeader: "Lyrics",
    lyricsPlaceholder: "Deine Lyrics erscheinen hier, sobald die KI sie erstellt hat.",
    generateSong: "Song generieren",
    songGenerating: "Song wird generiert...",
    successTitle: "Dein Song ist fertig!",
    successSubtitle: "Hör ihn dir jetzt an",
    trialCtaTitle: "Gefällt dir dein Song?",
    trialCtaSubtitle: "Registriere dich kostenlos, um ihn herunterzuladen und weitere Songs zu erstellen.",
    trialCtaButton: "Kostenlos registrieren",
  },
  en: {
    wizardTitle: "New Song",
    resetLabel: "Restart",
    steps: {
      language: "Language",
      occasion: "Occasion",
      recipient: "Recipient",
      name: "Name",
      details: "Details",
      style: "Style",
    },
    titles: {
      language: "Which language should the song be?",
      occasion: "Choose the occasion",
      recipient: "Who is the song for?",
      name: "What is their name?",
      details: "Personal details",
      style: "Choose the music style",
    },
    descriptions: {
      language: "Choose the language for your lyrics.",
      occasion: "What is the song for?",
      recipient: "Who should be surprised by the song?",
      name: "The name will appear in the song.",
      details: "Tell us about the person or the occasion. More details make the song more personal. (Optional)",
      style: "Which style fits best?",
    },
    placeholders: {
      occasion: "Or enter a custom occasion...",
      recipient: "Or enter a custom recipient...",
      name: "e.g., Maria, Tom, Mom...",
      details: "",
      style: "Or enter a custom style...",
      lyricsAi: "e.g., Make the chorus more emotional...",
    },
    detailsExampleLabel: "Example:",
    nav: {
      back: "Back",
      next: "Next",
      generateLyrics: "Generate Lyrics",
      stepIndicator: (step, total) => `Step ${step} of ${total}`,
    },
    lyricsGenerating: "Creating lyrics...",
    lyricsHeader: "Lyrics",
    lyricsPlaceholder: "Your lyrics will appear here once the AI creates them.",
    generateSong: "Generate Song",
    songGenerating: "Generating song...",
    successTitle: "Your song is ready!",
    successSubtitle: "Listen to it now",
    trialCtaTitle: "Do you like your song?",
    trialCtaSubtitle: "Register for free to download it and create more songs.",
    trialCtaButton: "Register for free",
  },
  ar: {
    wizardTitle: "أغنية جديدة",
    resetLabel: "إعادة البدء",
    steps: {
      language: "اللغة",
      occasion: "المناسبة",
      recipient: "لمن",
      name: "الاسم",
      details: "التفاصيل",
      style: "الأسلوب",
    },
    titles: {
      language: "ما لغة الأغنية؟",
      occasion: "اختر المناسبة",
      recipient: "لمن هذه الأغنية؟",
      name: "ما اسم الشخص؟",
      details: "تفاصيل شخصية",
      style: "اختر الأسلوب الموسيقي",
    },
    descriptions: {
      language: "اختر لغة كلمات الأغنية.",
      occasion: "ما المناسبة التي تُكتب لها الأغنية؟",
      recipient: "من الشخص الذي تريد مفاجأته؟",
      name: "سيُذكر الاسم في الأغنية.",
      details: "أخبرنا عن الشخص أو المناسبة. كلما زادت التفاصيل أصبحت الأغنية أكثر خصوصية. (اختياري)",
      style: "أي أسلوب هو الأنسب؟",
    },
    placeholders: {
      occasion: "أو اكتب مناسبة مختلفة...",
      recipient: "أو اكتب لمن تكون الأغنية...",
      name: "مثال: ماريا، توم، أمي...",
      details: "",
      style: "أو اكتب أسلوبًا مختلفًا...",
      lyricsAi: "مثال: اجعل اللازمة أكثر عاطفية...",
    },
    detailsExampleLabel: "مثال:",
    nav: {
      back: "رجوع",
      next: "التالي",
      generateLyrics: "إنشاء الكلمات",
      stepIndicator: (step, total) => `الخطوة ${step} من ${total}`,
    },
    lyricsGenerating: "جارٍ إنشاء الكلمات...",
    lyricsHeader: "الكلمات",
    lyricsPlaceholder: "ستظهر الكلمات هنا بعد أن ينشئها الذكاء الاصطناعي.",
    generateSong: "إنشاء الأغنية",
    songGenerating: "جارٍ إنشاء الأغنية...",
    successTitle: "أغنيتك جاهزة!",
    successSubtitle: "استمع إليها الآن",
    trialCtaTitle: "هل أعجبتك أغنيتك؟",
    trialCtaSubtitle: "سجل مجانًا لتحميلها وإنشاء المزيد من الأغاني.",
    trialCtaButton: "سجل مجانًا",
  },
};

const OPTION_SETS = {
  occasion: {
    de: [
      { value: "Geburtstag", label: "Geburtstag", emoji: "🎂", suggestRecipient: "" },
      { value: "Hochzeit", label: "Hochzeit", emoji: "💍", suggestRecipient: "Brautpaar" },
      { value: "Jubiläum", label: "Jubiläum", emoji: "🎉", suggestRecipient: "" },
      { value: "Valentinstag", label: "Valentinstag", emoji: "❤️", suggestRecipient: "Partner/in" },
      { value: "Weihnachten", label: "Weihnachten", emoji: "🎄", suggestRecipient: "Familie" },
      { value: "Muttertag", label: "Muttertag", emoji: "💐", suggestRecipient: "Mutter" },
      { value: "Vatertag", label: "Vatertag", emoji: "👔", suggestRecipient: "Vater" },
      { value: "Geburt", label: "Geburt", emoji: "👶", suggestRecipient: "Baby" },
    ],
    en: [
      { value: "Birthday", label: "Birthday", emoji: "🎂", suggestRecipient: "" },
      { value: "Wedding", label: "Wedding", emoji: "💍", suggestRecipient: "Couple" },
      { value: "Anniversary", label: "Anniversary", emoji: "🎉", suggestRecipient: "" },
      { value: "Valentine's Day", label: "Valentine's Day", emoji: "❤️", suggestRecipient: "Partner" },
      { value: "Christmas", label: "Christmas", emoji: "🎄", suggestRecipient: "Family" },
      { value: "Mother's Day", label: "Mother's Day", emoji: "💐", suggestRecipient: "Mother" },
      { value: "Father's Day", label: "Father's Day", emoji: "👔", suggestRecipient: "Father" },
      { value: "Birth", label: "Birth", emoji: "👶", suggestRecipient: "Baby" },
    ],
    ar: [
      { value: "عيد ميلاد", label: "عيد ميلاد", emoji: "🎂", suggestRecipient: "" },
      { value: "زفاف", label: "زفاف", emoji: "💍", suggestRecipient: "العروسان" },
      { value: "ذكرى سنوية", label: "ذكرى سنوية", emoji: "🎉", suggestRecipient: "" },
      { value: "عيد الحب", label: "عيد الحب", emoji: "❤️", suggestRecipient: "الشريك/الشريكة" },
      { value: "عيد الميلاد", label: "عيد الميلاد", emoji: "🎄", suggestRecipient: "العائلة" },
      { value: "عيد الأم", label: "عيد الأم", emoji: "💐", suggestRecipient: "الأم" },
      { value: "عيد الأب", label: "عيد الأب", emoji: "👔", suggestRecipient: "الأب" },
      { value: "ولادة", label: "ولادة", emoji: "👶", suggestRecipient: "رضيع" },
    ],
  },
  recipient: {
    de: [
      { value: "Freund/in", label: "Freund/in", emoji: "👫" },
      { value: "Partner/in", label: "Partner/in", emoji: "💑" },
      { value: "Mutter", label: "Mutter", emoji: "👩" },
      { value: "Vater", label: "Vater", emoji: "👨" },
      { value: "Kind", label: "Kind", emoji: "👧" },
      { value: "Baby", label: "Baby", emoji: "👶" },
      { value: "Geschwister", label: "Geschwister", emoji: "👧👦" },
      { value: "Großeltern", label: "Großeltern", emoji: "👴👵" },
      { value: "Familie", label: "Familie", emoji: "👨‍👩‍👧‍👦" },
      { value: "Brautpaar", label: "Brautpaar", emoji: "💍" },
      { value: "Kollege/in", label: "Kollege/in", emoji: "💼" },
      { value: "Gruppe", label: "Gruppe", emoji: "👥" },
    ],
    en: [
      { value: "Friend", label: "Friend", emoji: "👫" },
      { value: "Partner", label: "Partner", emoji: "💑" },
      { value: "Mother", label: "Mother", emoji: "👩" },
      { value: "Father", label: "Father", emoji: "👨" },
      { value: "Child", label: "Child", emoji: "👧" },
      { value: "Baby", label: "Baby", emoji: "👶" },
      { value: "Siblings", label: "Siblings", emoji: "👧👦" },
      { value: "Grandparents", label: "Grandparents", emoji: "👴👵" },
      { value: "Family", label: "Family", emoji: "👨‍👩‍👧‍👦" },
      { value: "Couple", label: "Couple", emoji: "💍" },
      { value: "Colleague", label: "Colleague", emoji: "💼" },
      { value: "Group", label: "Group", emoji: "👥" },
    ],
    ar: [
      { value: "صديق/صديقة", label: "صديق/صديقة", emoji: "👫" },
      { value: "الشريك/الشريكة", label: "الشريك/الشريكة", emoji: "💑" },
      { value: "الأم", label: "الأم", emoji: "👩" },
      { value: "الأب", label: "الأب", emoji: "👨" },
      { value: "الطفل", label: "الطفل", emoji: "👧" },
      { value: "رضيع", label: "رضيع", emoji: "👶" },
      { value: "الأشقاء", label: "الأشقاء", emoji: "👧👦" },
      { value: "الأجداد", label: "الأجداد", emoji: "👴👵" },
      { value: "العائلة", label: "العائلة", emoji: "👨‍👩‍👧‍👦" },
      { value: "العروسان", label: "العروسان", emoji: "💍" },
      { value: "زميل/زميلة", label: "زميل/زميلة", emoji: "💼" },
      { value: "مجموعة", label: "مجموعة", emoji: "👥" },
    ],
  },
  style: {
    de: [
      { value: "Pop", label: "Pop", emoji: "🎵" },
      { value: "Rock", label: "Rock", emoji: "🎸" },
      { value: "Rap", label: "Rap", emoji: "🎤" },
      { value: "Schlager", label: "Schlager", emoji: "🎺" },
      { value: "Ballade", label: "Ballade", emoji: "🎹" },
      { value: "Country", label: "Country", emoji: "🤠" },
      { value: "Jazz", label: "Jazz", emoji: "🎷" },
      { value: "Elektronisch", label: "Elektronisch", emoji: "🎧" },
    ],
    en: [
      { value: "Pop", label: "Pop", emoji: "🎵" },
      { value: "Rock", label: "Rock", emoji: "🎸" },
      { value: "Rap", label: "Rap", emoji: "🎤" },
      { value: "Schlager", label: "Schlager", emoji: "🎺" },
      { value: "Ballad", label: "Ballad", emoji: "🎹" },
      { value: "Country", label: "Country", emoji: "🤠" },
      { value: "Jazz", label: "Jazz", emoji: "🎷" },
      { value: "Electronic", label: "Electronic", emoji: "🎧" },
    ],
    ar: [
      { value: "بوب", label: "بوب", emoji: "🎵" },
      { value: "روك", label: "روك", emoji: "🎸" },
      { value: "راب", label: "راب", emoji: "🎤" },
      { value: "شلاجر", label: "شلاجر", emoji: "🎺" },
      { value: "بالاد", label: "بالاد", emoji: "🎹" },
      { value: "كانتري", label: "كانتري", emoji: "🤠" },
      { value: "جاز", label: "جاز", emoji: "🎷" },
      { value: "إلكتروني", label: "إلكتروني", emoji: "🎧" },
    ],
  },
};

const DETAILS_EXAMPLES = {
  de: [
    "Sie liebt Wandern und die Natur, wir kennen uns seit 10 Jahren...",
    "Er ist der beste Papa der Welt, immer für uns da...",
    "Sie hat das schönste Lächeln und liebt Musik über alles...",
    "Wir haben uns in der Schule kennengelernt, seitdem unzertrennlich...",
    "Er kocht leidenschaftlich gern und macht die besten Pasta...",
    "Sie tanzt gern und hört am liebsten 80er Musik...",
    "Er ist ein Fußball-Fan und geht jedes Wochenende zum Spiel...",
    "Sie liebt Katzen und hat drei davon zu Hause...",
    "Wir haben so viel zusammen erlebt, Reisen, Abenteuer...",
    "Er arbeitet hart für die Familie und verdient Anerkennung...",
    "Sie ist meine beste Freundin seit der Kindergartenzeit...",
    "Er hat einen tollen Humor und bringt alle zum Lachen...",
  ],
  en: [
    "She loves hiking and nature, we've known each other for 10 years...",
    "He's the best dad in the world, always there for us...",
    "She has the most beautiful smile and loves music more than anything...",
    "We met at school and have been inseparable ever since...",
    "He loves cooking and makes the best pasta...",
    "She loves dancing and listens to 80s music...",
    "He's a football fan and goes to the game every weekend...",
    "She loves cats and has three at home...",
    "We've been through so much together—travel, adventures...",
    "He works hard for the family and deserves recognition...",
    "She's been my best friend since kindergarten...",
    "He has a great sense of humor and makes everyone laugh...",
  ],
  ar: [
    "تحب المشي في الطبيعة ونعرف بعضنا منذ 10 سنوات...",
    "إنه أفضل أب في العالم، دائمًا بجانبنا...",
    "لديها أجمل ابتسامة وتحب الموسيقى كثيرًا...",
    "تعرفنا في المدرسة ومنذ ذلك الحين ونحن لا نفترق...",
    "يحب الطبخ ويُعد أفضل معكرونة...",
    "تحب الرقص وتستمع كثيرًا إلى موسيقى الثمانينات...",
    "إنه من عشاق كرة القدم ويذهب إلى المباراة كل عطلة...",
    "تحب القطط ولديها ثلاث منها في المنزل...",
    "عشنا الكثير معًا: سفر ومغامرات...",
    "يعمل بجد من أجل العائلة ويستحق التقدير...",
    "هي صديقتي المفضلة منذ الروضة...",
    "لديه حس دعابة رائع ويجعل الجميع يضحك...",
  ],
};

function resolveLanguage(value) {
  const v = (value || "").toString().toLowerCase();
  if (v.includes("english")) return "en";
  if (v.includes("العربية") || v.includes("arab")) return "ar";
  if (v.includes("deutsch")) return "de";
  return "de";
}

function getLangCode() {
  return resolveLanguage(wizardData.language);
}

function getUiText() {
  return UI_TEXT[getLangCode()] || UI_TEXT.de;
}

function getDetailsExamples() {
  return DETAILS_EXAMPLES[getLangCode()] || DETAILS_EXAMPLES.de;
}

function setButtonLabel(btn, label, iconPosition = "after") {
  if (!btn) return;
  const icon = btn.querySelector("svg");
  if (!icon) {
    btn.textContent = label;
    return;
  }
  const iconHtml = icon.outerHTML;
  btn.innerHTML = iconPosition === "before" ? `${iconHtml} ${label}` : `${label} ${iconHtml}`;
}

function updateOptionCards(stepIndex, options, isOccasion = false) {
  const stepEl = document.querySelector(`.wizard-step[data-step="${stepIndex}"]`);
  if (!stepEl) return;
  const cards = stepEl.querySelectorAll(".option-card");
  cards.forEach((card, idx) => {
    const opt = options[idx];
    if (!opt) return;
    card.dataset.value = opt.value;
    if (isOccasion) {
      card.dataset.suggestRecipient = opt.suggestRecipient || "";
    }
    card.textContent = opt.emoji ? `${opt.emoji} ${opt.label}` : opt.label;
  });
  const selected = stepEl.querySelector(".option-card.selected");
  if (selected) {
    const stepKey = WIZARD_STEPS[stepIndex]?.key;
    if (stepKey) wizardData[stepKey] = selected.dataset.value;
  }
}

function updateLyricsPlaceholder() {
  if (!lyricsContent) return;
  const t = getUiText();
  const placeholder = lyricsContent.querySelector(".placeholder");
  if (placeholder) {
    placeholder.textContent = t.lyricsPlaceholder;
  }
  const trialPlaceholder = lyricsContent.querySelector(".lyrics-placeholder p");
  if (trialPlaceholder) {
    trialPlaceholder.textContent = t.lyricsPlaceholder;
  }
}

function getLyricsPlaceholderHtml() {
  const t = getUiText();
  return `<div class="lyrics-placeholder">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
    <p>${t.lyricsPlaceholder}</p>
  </div>`;
}

function updateNavLabels(step) {
  const t = getUiText();
  setButtonLabel(backBtn, t.nav.back, "before");
  const nextLabel = step === WIZARD_STEPS.length - 1 ? t.nav.generateLyrics : t.nav.next;
  setButtonLabel(nextBtn, nextLabel, "after");
  if (stepIndicator) {
    stepIndicator.textContent = t.nav.stepIndicator(step + 1, WIZARD_STEPS.length);
  }
}

function applyLanguageUI(value) {
  const lang = resolveLanguage(value);
  const t = UI_TEXT[lang] || UI_TEXT.de;

  document.documentElement.lang = lang;

  const wizardPanel = document.querySelector(".wizard-panel");
  const infoPanel = document.querySelector(".info-panel");
  if (lang === "ar") {
    if (wizardPanel) wizardPanel.setAttribute("dir", "rtl");
    if (infoPanel) infoPanel.setAttribute("dir", "rtl");
  } else {
    if (wizardPanel) wizardPanel.removeAttribute("dir");
    if (infoPanel) infoPanel.removeAttribute("dir");
  }

  const wizardTitle = document.querySelector(".wizard-header h2");
  if (wizardTitle) wizardTitle.textContent = t.wizardTitle;
  const resetBtn = document.getElementById("reset-wizard-btn");
  if (resetBtn) {
    setButtonLabel(resetBtn, t.resetLabel, "before");
    resetBtn.title = t.resetLabel;
  }

  const stepLabels = [
    t.steps.language,
    t.steps.occasion,
    t.steps.recipient,
    t.steps.name,
    t.steps.details,
    t.steps.style,
  ];
  progressSteps.forEach((el, idx) => {
    const labelEl = el.querySelector(".step-label");
    if (labelEl && stepLabels[idx]) labelEl.textContent = stepLabels[idx];
  });

  const stepTitles = [
    t.titles.language,
    t.titles.occasion,
    t.titles.recipient,
    t.titles.name,
    t.titles.details,
    t.titles.style,
  ];
  const stepDescs = [
    t.descriptions.language,
    t.descriptions.occasion,
    t.descriptions.recipient,
    t.descriptions.name,
    t.descriptions.details,
    t.descriptions.style,
  ];
  wizardStepsEl.forEach((el, idx) => {
    const titleEl = el.querySelector("h3");
    const descEl = el.querySelector(".step-desc");
    if (titleEl && stepTitles[idx]) titleEl.textContent = stepTitles[idx];
    if (descEl && stepDescs[idx]) descEl.textContent = stepDescs[idx];
  });

  updateOptionCards(1, OPTION_SETS.occasion[lang], true);
  updateOptionCards(2, OPTION_SETS.recipient[lang]);
  updateOptionCards(5, OPTION_SETS.style[lang]);

  const occasionInput = document.querySelector('.wizard-step[data-step="1"] .custom-input');
  if (occasionInput) occasionInput.placeholder = t.placeholders.occasion;
  const recipientInput = document.querySelector('.wizard-step[data-step="2"] .custom-input');
  if (recipientInput) recipientInput.placeholder = t.placeholders.recipient;
  const styleInput = document.querySelector('.wizard-step[data-step="5"] .custom-input');
  if (styleInput) styleInput.placeholder = t.placeholders.style;

  const nameInput = document.getElementById("name-input");
  if (nameInput) nameInput.placeholder = t.placeholders.name;
  const detailsInput = document.getElementById("details-input");
  if (detailsInput) detailsInput.placeholder = t.placeholders.details;

  const exampleLabel = document.querySelector(".details-examples .example-label");
  if (exampleLabel) exampleLabel.textContent = t.detailsExampleLabel;

  if (lyricsGenerating) {
    const span = lyricsGenerating.querySelector("span");
    if (span) span.textContent = t.lyricsGenerating;
  }

  const lyricsHeader = document.querySelector(".lyrics-card .lyrics-header h3");
  if (lyricsHeader) lyricsHeader.textContent = t.lyricsHeader;

  if (lyricsAiInput) lyricsAiInput.placeholder = t.placeholders.lyricsAi;

  const generateHasIcon = generateBtn && generateBtn.querySelector("svg");
  setButtonLabel(generateBtn, t.generateSong, generateHasIcon ? "before" : "after");

  if (progressText) progressText.textContent = t.songGenerating;

  if (songSuccessBox) {
    const titleEl = songSuccessBox.querySelector("h4");
    const subEl = songSuccessBox.querySelector("p");
    if (titleEl) titleEl.textContent = t.successTitle;
    if (subEl) subEl.textContent = t.successSubtitle;
  }

  const trialCta = document.getElementById("trial-cta");
  if (trialCta) {
    const ctaTitle = trialCta.querySelector("h3");
    const ctaText = trialCta.querySelector("p");
    const ctaBtn = trialCta.querySelector(".cta-btn");
    if (ctaTitle) ctaTitle.textContent = t.trialCtaTitle;
    if (ctaText) ctaText.textContent = t.trialCtaSubtitle;
    if (ctaBtn) ctaBtn.textContent = t.trialCtaButton;
  }

  updateLyricsPlaceholder();
  updateNavLabels(currentStep);
  updateStepSelections();
  updateNextButton();

  const stepKey = WIZARD_STEPS[currentStep]?.key;
  if (stepKey === "details" && !wizardData.details) {
    startExamplesRotation();
  } else {
    stopExamplesRotation();
  }

}

// DOM
const initialLoader = document.getElementById("initial-loader");
const lyricsContent = document.getElementById("trial-lyrics-content");
const generateBtn = document.getElementById("trial-generate-btn");
const progressBar = document.getElementById("trial-progress");
const progressFill = document.getElementById("trial-progress-fill");
const progressText = document.getElementById("trial-progress-text");
const progressPercent = document.getElementById("trial-progress-percent");
const audioPlayer = document.getElementById("trial-audio-player");
const trialCta = document.getElementById("trial-cta");
const songSuccessBox = document.getElementById("song-success-box");
const playPauseBtn = document.getElementById("play-pause-btn");
const audioProgressBar = document.getElementById("audio-progress-bar");
const audioProgressFill = document.getElementById("audio-progress-fill");
const audioCurrentTime = document.getElementById("audio-current-time");
const audioDuration = document.getElementById("audio-duration");
const lyricsActions = document.getElementById("lyrics-actions");
const editLyricsBtn = document.getElementById("edit-lyrics-btn");
const saveLyricsBtn = document.getElementById("save-lyrics-btn");
const cancelLyricsBtn = document.getElementById("cancel-lyrics-btn");
const lyricsEditor = document.getElementById("lyrics-editor");
const lyricsAiBox = document.getElementById("lyrics-ai-box");
const lyricsAiInput = document.getElementById("lyrics-ai-input");
const lyricsAiBtn = document.getElementById("lyrics-ai-btn");
const lyricsAiStatus = document.getElementById("lyrics-ai-status");
let audioPlayerInitialized = false;

// Wizard DOM
const wizardStepsEl = document.querySelectorAll(".wizard-step");
const progressSteps = document.querySelectorAll(".progress-step");
const backBtn = document.getElementById("wizard-back-btn");
const nextBtn = document.getElementById("wizard-next-btn");
const stepIndicator = document.getElementById("wizard-step-indicator");
const lyricsGenerating = document.getElementById("lyrics-generating");

applyLanguageUI(wizardData.language);

// Utility
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function showError(msg) {
  let el = document.getElementById("wizard-error");
  if (!el) {
    el = document.createElement("div");
    el.id = "wizard-error";
    el.style.cssText = "background:#fde8e8;color:#d32f2f;padding:12px 16px;border-radius:8px;margin-top:12px;font-size:0.9rem;text-align:center;border:1px solid #f5c6c6;";
    const wizardNav = document.querySelector(".wizard-nav");
    wizardNav.parentNode.insertBefore(el, wizardNav.nextSibling);
  }
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 6000);
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function updateGenerationProgress() {
  if (!generationStartedAt) return;
  const elapsedSec = Math.max(0, Math.floor((Date.now() - generationStartedAt) / 1000));
  const percent = Math.min(99, Math.round((elapsedSec / GENERATION_ESTIMATE_SEC) * 100));
  if (progressFill) progressFill.style.width = `${percent}%`;
  if (progressPercent) progressPercent.textContent = `${percent}%`;
  if (progressText) {
    progressText.textContent = `${getUiText().songGenerating} | ${formatDuration(elapsedSec)} / ~${formatDuration(GENERATION_ESTIMATE_SEC)}`;
  }
}

function startGenerationTimer() {
  generationStartedAt = Date.now();
  updateGenerationProgress();
  if (generationTimer) clearInterval(generationTimer);
  generationTimer = setInterval(updateGenerationProgress, 1000);
}

function stopGenerationTimer() {
  if (generationTimer) {
    clearInterval(generationTimer);
  }
  generationTimer = null;
  generationStartedAt = null;
}

// ===== Rotating Examples for Details =====
function startExamplesRotation() {
  const exampleText = document.getElementById("example-text");
  const detailsExamples = document.getElementById("details-examples");
  
  if (!exampleText || !detailsExamples) return;
  
  detailsExamples.style.display = "flex";
  currentExampleIndex = Math.floor(Math.random() * getDetailsExamples().length);
  exampleText.textContent = examples[currentExampleIndex];
  
  if (exampleInterval) clearInterval(exampleInterval);
  
  exampleInterval = setInterval(() => {
    currentExampleIndex = (currentExampleIndex + 1) % examples.length;
    exampleText.style.opacity = "0";
    exampleText.style.transform = "translateX(10px)";
    
    setTimeout(() => {
      exampleText.textContent = examples[currentExampleIndex];
      exampleText.style.opacity = "1";
      exampleText.style.transform = "translateX(0)";
    }, 200);
  }, 2500);
}

function stopExamplesRotation() {
  if (exampleInterval) {
    clearInterval(exampleInterval);
    exampleInterval = null;
  }
  
  const detailsExamples = document.getElementById("details-examples");
  if (detailsExamples) {
    detailsExamples.style.display = "none";
  }
}

// ===== Smart Recipient Suggestions =====
function suggestRecipient(occasion, suggestedValue) {
  if (!suggestedValue) return;
  
  const recipientCards = document.querySelectorAll("#recipient-cards .option-card");
  recipientCards.forEach(card => card.classList.remove("suggested"));
  
  recipientCards.forEach(card => {
    if (card.dataset.value === suggestedValue) {
      card.classList.add("suggested");
    }
  });
}

// ===== Update Step Selections =====
function updateStepSelections() {
    const selectionMap = {
    language: wizardData.language,
    occasion: wizardData.occasion,
    recipient: wizardData.recipient,
    name: wizardData.name,
    details: wizardData.details ? "✓" : "",
    style: wizardData.style,
  };

  document.querySelectorAll(".step-selection").forEach(el => {
    const key = el.dataset.selection;
    const value = selectionMap[key];
    const parentStep = el.closest(".progress-step");
    
    if (value) {
      el.textContent = value.length > 12 ? value.substring(0, 11) + "…" : value;
      parentStep.classList.add("has-selection");
    } else {
      el.textContent = "";
      parentStep.classList.remove("has-selection");
    }
  });
}

// ===== Wizard =====
function goToStep(step) {
  currentStep = step;

  wizardStepsEl.forEach(el => {
    el.classList.toggle("active", parseInt(el.dataset.step) === step);
  });

  progressSteps.forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.toggle("active", s === step);
    el.classList.toggle("completed", s < step);
  });

  updateStepSelections();

  backBtn.style.visibility = step === 0 ? "hidden" : "visible";

  // Navigation labels
  updateNavLabels(step);
  updateNextButton();

    // Handle rotating examples for details step
  const stepKey = WIZARD_STEPS[step]?.key;
  if (stepKey === "details") {
    // Details step - start rotating examples if no details entered
    if (!wizardData.details) {
      startExamplesRotation();
    }
  } else {
    stopExamplesRotation();
  }

  if (pendingLyrics) {
    pendingLyrics = null;
    pendingStyle = null;
    generateBtn.disabled = true;
    lyricsContent.classList.remove("has-lyrics");
    lyricsContent.innerHTML = getLyricsPlaceholderHtml();
    if (lyricsActions) lyricsActions.style.display = "none";
    if (lyricsAiBox) lyricsAiBox.style.display = "none";
    if (lyricsAiStatus) {
      lyricsAiStatus.textContent = "";
      lyricsAiStatus.className = "lyrics-ai-status";
    }
    if (lyricsAiInput) lyricsAiInput.value = "";
    exitEditMode();
    audioPlayer.style.display = "none";
    progressBar.style.display = "none";
  }
}

function updateNextButton() {
  const key = WIZARD_STEPS[currentStep].key;
  if (key === "details") {
    nextBtn.disabled = false;
  } else {
    nextBtn.disabled = !wizardData[key];
  }
}

function handleNextStep() {
  if (currentStep < WIZARD_STEPS.length - 1) {
    goToStep(currentStep + 1);
  } else {
    generateLyrics();
  }
}

function handleBackStep() {
  if (currentStep > 0) {
    goToStep(currentStep - 1);
  }
}

async function generateLyrics() {
  nextBtn.disabled = true;
  lyricsGenerating.style.display = "flex";

  try {
    const res = await fetch("/api/wizard/trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wizardData),
    });

    const data = await res.json();
    lyricsGenerating.style.display = "none";

    if (!res.ok) {
      showError(data.error || "Lyrics-Generierung fehlgeschlagen");
      nextBtn.disabled = false;
      return;
    }

    pendingLyrics = data.lyrics;
    pendingStyle = data.style;
    displayLyrics(data.lyrics);
  } catch {
    lyricsGenerating.style.display = "none";
    nextBtn.disabled = false;
    showError("Verbindungsfehler. Bitte versuche es erneut.");
  }
}

function displayLyrics(text) {
  const tagRe = /\[(verse|chorus|bridge|outro|intro)\]/i;

  let raw = text.trim();

  // Try to extract only the lyrics portion (after first tag)
  if (tagRe.test(raw)) {
    const lines = raw.split("\n");
    const lyricLines = [];
    let inLyrics = false;

    for (let i = 0; i < lines.length; i++) {
      if (tagRe.test(lines[i])) {
        inLyrics = true;
      }
      if (inLyrics) {
        lyricLines.push(lines[i]);
      }
    }

    if (lyricLines.length > 0) {
      raw = lyricLines.join("\n").trim();
    }
  }

  pendingLyrics = raw;

  const escaped = escapeHtml(raw);
  const formatted = escaped.replace(
    /\[(verse|chorus|bridge|outro|intro)\]/gi,
    (_, tag) => `<span class="tag">[${tag}]</span>`
  );
  
  lyricsContent.classList.remove("has-lyrics");
  
  lyricsContent.innerHTML = formatted;
  if (lyricsActions) lyricsActions.style.display = "flex";
  if (lyricsAiBox) lyricsAiBox.style.display = "flex";
  exitEditMode();

  requestAnimationFrame(() => {
    lyricsContent.classList.add("has-lyrics");
  });

  generateBtn.disabled = false;
}

// ===== Lyrics Editing =====
function enterEditMode() {
  if (!pendingLyrics || !lyricsEditor || !lyricsContent) return;
  lyricsEditor.value = pendingLyrics;
  lyricsContent.style.display = "none";
  lyricsEditor.style.display = "block";
  if (editLyricsBtn) editLyricsBtn.style.display = "none";
  if (saveLyricsBtn) saveLyricsBtn.style.display = "inline-flex";
  if (cancelLyricsBtn) cancelLyricsBtn.style.display = "inline-flex";
  lyricsEditor.focus();
}

function exitEditMode() {
  if (!lyricsEditor || !lyricsContent) return;
  lyricsEditor.style.display = "none";
  lyricsContent.style.display = "block";
  if (editLyricsBtn) editLyricsBtn.style.display = "inline-flex";
  if (saveLyricsBtn) saveLyricsBtn.style.display = "none";
  if (cancelLyricsBtn) cancelLyricsBtn.style.display = "none";
}

function saveManualEdits() {
  if (!lyricsEditor) return;
  const edited = lyricsEditor.value.trim();
  if (edited) {
    displayLyrics(edited);
  } else {
    exitEditMode();
  }
}

if (editLyricsBtn) editLyricsBtn.addEventListener("click", enterEditMode);
if (cancelLyricsBtn) cancelLyricsBtn.addEventListener("click", () => { exitEditMode(); });
if (saveLyricsBtn) saveLyricsBtn.addEventListener("click", saveManualEdits);

// AI lyrics editing
if (lyricsAiBtn) {
  lyricsAiBtn.addEventListener("click", requestAiEdit);
}
if (lyricsAiInput) {
  lyricsAiInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") requestAiEdit();
  });
}

async function requestAiEdit() {
  if (!lyricsAiInput || !lyricsAiBtn || !lyricsAiStatus) return;
  const prompt = lyricsAiInput.value.trim();
  if (!prompt || !pendingLyrics) return;

  lyricsAiBtn.disabled = true;
  lyricsAiInput.disabled = true;
  lyricsAiStatus.textContent = "AI bearbeitet Lyrics...";
  lyricsAiStatus.className = "lyrics-ai-status loading";

  try {
    const res = await fetch("/api/lyrics/edit/trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lyrics: pendingLyrics, prompt, style: pendingStyle }),
    });
    const data = await res.json();

    if (!res.ok) {
      lyricsAiStatus.textContent = data.error || "Bearbeitung fehlgeschlagen";
      lyricsAiStatus.className = "lyrics-ai-status error";
      return;
    }

    displayLyrics(data.lyrics);
    lyricsAiInput.value = "";
    lyricsAiStatus.textContent = "Lyrics aktualisiert!";
    lyricsAiStatus.className = "lyrics-ai-status success";
    setTimeout(() => { lyricsAiStatus.textContent = ""; }, 3000);
  } catch {
    lyricsAiStatus.textContent = "Verbindungsfehler";
    lyricsAiStatus.className = "lyrics-ai-status error";
  } finally {
    lyricsAiBtn.disabled = false;
    lyricsAiInput.disabled = false;
  }
}

// Option card clicks — auto-advance
document.querySelectorAll(".option-cards").forEach(container => {
  container.addEventListener("click", (e) => {
    const card = e.target.closest(".option-card");
    if (!card) return;

    const step = card.closest(".wizard-step");
    const stepIndex = parseInt(step.dataset.step);
    const stepKey = WIZARD_STEPS[stepIndex].key;

    container.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));
    card.classList.add("selected");

    const customInput = step.querySelector(".custom-input");
    if (customInput) customInput.value = "";

    wizardData[stepKey] = card.dataset.value;
    updateStepSelections();

    if (stepKey === "language") {
      applyLanguageUI(wizardData.language);
    }

    // If occasion selected, suggest a recipient
    if (stepKey === "occasion" && card.dataset.suggestRecipient) {
      suggestRecipient(card.dataset.value, card.dataset.suggestRecipient);
    }

    // If recipient selected, remove suggestions styling
    if (stepKey === "recipient") {
      document.querySelectorAll("#recipient-cards .option-card").forEach(c => c.classList.remove("suggested"));
    }

    setTimeout(() => handleNextStep(), 250);
  });
});

// Custom input handling
document.querySelectorAll(".custom-input").forEach(input => {
  input.addEventListener("input", () => {
    const step = input.closest(".wizard-step");
    const stepIndex = parseInt(step.dataset.step);
    const stepKey = WIZARD_STEPS[stepIndex].key;

    step.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));

    wizardData[stepKey] = input.value.trim();
    updateNextButton();
    updateStepSelections();

    if (stepKey === "language") {
      applyLanguageUI(wizardData.language);
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !nextBtn.disabled) {
      e.preventDefault();
      handleNextStep();
    }
  });
});

// Name input
const nameInput = document.getElementById("name-input");
if (nameInput) {
  nameInput.addEventListener("input", () => {
    wizardData.name = nameInput.value.trim();
    updateNextButton();
    updateStepSelections();
  });
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !nextBtn.disabled) {
      e.preventDefault();
      handleNextStep();
    }
  });
}

// Details textarea (optional)
const detailsInput = document.getElementById("details-input");
if (detailsInput) {
  detailsInput.addEventListener("input", () => {
    wizardData.details = detailsInput.value.trim();
    updateStepSelections();
    
    // Stop rotating examples when user starts typing
    if (wizardData.details.length > 0) {
      stopExamplesRotation();
    } else {
      startExamplesRotation();
    }
  });
  
  detailsInput.addEventListener("focus", () => {
    if (!wizardData.details) {
      startExamplesRotation();
    }
  });
}

// Navigation
nextBtn.addEventListener("click", handleNextStep);
backBtn.addEventListener("click", handleBackStep);

// ===== Song Generation =====
generateBtn.addEventListener("click", async () => {
  if (!pendingLyrics || hasGeneratedSong) return;

  const lyrics = pendingLyrics;
  const style = pendingStyle || "Pop, eingängige Melodie";

  generateBtn.disabled = true;
  progressBar.style.display = "flex";
  if (progressFill) progressFill.style.width = "0%";
  if (progressPercent) progressPercent.textContent = "0%";
  startGenerationTimer();
  audioPlayer.style.display = "none";

  try {
    const res = await fetch("/api/generate/trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lyrics, style }),
    });

    const data = await res.json();

    if (!res.ok) {
      progressBar.style.display = "none";
      generateBtn.disabled = false;
      stopGenerationTimer();
      showError(data.error || "Song-Generierung fehlgeschlagen.");
      return;
    }

    hasGeneratedSong = true;
    pollSongStatus(data.songId);
  } catch {
    progressBar.style.display = "none";
    generateBtn.disabled = false;
    stopGenerationTimer();
    showError("Verbindungsfehler bei der Generierung.");
  }
});

// Poll song status
async function pollSongStatus(songId) {
  let attempts = 0;
  const maxAttempts = 60;

  const interval = setInterval(async () => {
    attempts++;

    if (attempts > maxAttempts) {
      clearInterval(interval);
      progressBar.style.display = "none";
      stopGenerationTimer();
      showError("Die Song-Generierung dauert länger als erwartet. Bitte lade die Seite neu.");
      return;
    }

    try {
      const res = await fetch(`/api/songs/trial/${songId}`);
      const song = await res.json();

      if (song.status === "completed" && song.file_path) {
        clearInterval(interval);
        progressBar.style.display = "none";
        stopGenerationTimer();
        
        // Show success box with custom player
        audioPlayer.src = "/" + song.file_path;
        songSuccessBox.style.display = "block";
        trialCta.style.display = "block";
        
        // Setup custom audio player
        setupCustomAudioPlayer();
      } else if (song.status === "failed") {
        clearInterval(interval);
        progressBar.style.display = "none";
        stopGenerationTimer();
        generateBtn.disabled = false;
        hasGeneratedSong = false;
        showError("Song-Generierung fehlgeschlagen: " + (song.error_message || "Unbekannter Fehler"));
      }
    } catch (err) {
      console.error("Poll error:", err);
    }
  }, 3000);
}

// ===== Custom Audio Player =====
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function setupCustomAudioPlayer() {
  if (!audioPlayer || !playPauseBtn) return;

  const playIcon = playPauseBtn.querySelector(".play-icon");
  const pauseIcon = playPauseBtn.querySelector(".pause-icon");

  const resetPlayerUi = () => {
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
    }
    if (audioProgressFill) audioProgressFill.style.width = "0%";
    if (audioCurrentTime) audioCurrentTime.textContent = "0:00";
    if (audioDuration) audioDuration.textContent = "0:00";
    if (playIcon) playIcon.style.display = "block";
    if (pauseIcon) pauseIcon.style.display = "none";
  };

  resetPlayerUi();

  if (audioPlayerInitialized) return;
  audioPlayerInitialized = true;

  // Update duration when metadata is loaded
  audioPlayer.addEventListener("loadedmetadata", () => {
    if (audioDuration && isFinite(audioPlayer.duration)) {
      audioDuration.textContent = formatTime(audioPlayer.duration);
    }
  });

  // Update progress as audio plays
  audioPlayer.addEventListener("timeupdate", () => {
    if (!audioProgressFill || !audioCurrentTime) return;
    if (!isFinite(audioPlayer.duration) || audioPlayer.duration <= 0) return;
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    audioProgressFill.style.width = `${progress}%`;
    audioCurrentTime.textContent = formatTime(audioPlayer.currentTime);
  });

  // Play/Pause toggle
  playPauseBtn.addEventListener("click", () => {
    if (audioPlayer.paused) {
      audioPlayer.play();
      playIcon.style.display = "none";
      pauseIcon.style.display = "block";
    } else {
      audioPlayer.pause();
      playIcon.style.display = "block";
      pauseIcon.style.display = "none";
    }
  });

  // When audio ends
  audioPlayer.addEventListener("ended", () => {
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
    audioProgressFill.style.width = "0%";
    audioCurrentTime.textContent = "0:00";
  });

  // Click on progress bar to seek
  if (audioProgressBar) {
    audioProgressBar.addEventListener("click", (e) => {
      if (!isFinite(audioPlayer.duration) || audioPlayer.duration <= 0) return;
      const rect = audioProgressBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const percentage = clickX / width;
      audioPlayer.currentTime = percentage * audioPlayer.duration;
    });
  }
}

// ===== Initialize =====
async function init() {
  await new Promise(resolve => setTimeout(resolve, 500));

  if (initialLoader) {
    initialLoader.classList.add("fade-out");
    setTimeout(() => {
      initialLoader.style.display = "none";
    }, 300);
  }
}

init();
