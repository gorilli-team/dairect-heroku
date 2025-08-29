const OpenAI = require('openai');
const logger = require('../utils/logger');
const cheerio = require('cheerio');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to parse GPT JSON response (handles markdown)
function parseGptJson(content) {
  let cleaned = content.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  
  return JSON.parse(cleaned.trim());
}

// Helper function to clean and reduce HTML for GPT processing
function cleanHtml(html) {
  const $ = cheerio.load(html);
  
  // Remove scripts, styles, comments
  $('script, style, noscript').remove();
  $('*').removeAttr('style');
  
  // Keep only relevant attributes for form elements
  $('input, select, button, textarea').each(function() {
    const $el = $(this);
    const keepAttrs = ['id', 'name', 'class', 'type', 'placeholder', 'value'];
    const attrs = this.attribs;
    
    Object.keys(attrs).forEach(attr => {
      if (!keepAttrs.includes(attr)) {
        $el.removeAttr(attr);
      }
    });
  });
  
  // Limit HTML size (GPT has token limits)
  let cleanedHtml = $.html();
  if (cleanedHtml.length > 50000) {
    cleanedHtml = cleanedHtml.substring(0, 50000) + '...';
  }
  
  return cleanedHtml;
}

async function analyzeSearchPage(html, searchParams) {
  logger.info('Analyzing search page with GPT');
  
  const cleanedHtml = cleanHtml(html);
  
  const prompt = `
Analizza questo HTML di una pagina SimpleBooking per identificare i selettori CSS per eseguire una ricerca di disponibilità hotel.

Piattaforma: SimpleBooking (simplebooking.it)
Parametri ricerca:
- Check-in: ${searchParams.checkinDate}
- Check-out: ${searchParams.checkoutDate} 
- Adulti: ${searchParams.adults}
- Bambini: ${searchParams.children || 0}

HTML:
${cleanedHtml}

Cerca specificamente:
- Pulsanti/elementi per aprire il selettore date (classi come .SearchWidget__Calendar_CTA, .date-picker-trigger)
- Selettori per giorni del calendario (classi come .Calendar__Day.enabled, .calendar-day:not(.disabled))
- Navigazione calendario (classi come .Calendar__Navigation__NextMonth, .Calendar__Navigation__PrevMonth)
- Selettori dropdown per adulti/bambini (classi come .SearchWidget__Allocations_CTA)
- Bottone "Cerca" o "Verifica disponibilità" (ID come #PanelSearchWidgetCTA)
- Elementi con attributi name/id relativi a booking, search, check-in, check-out

IMPORTANTE per il calendario SimpleBooking:
- I pulsanti date di solito hanno classe .SearchWidget__Calendar_CTA
- I giorni del calendario hanno classe .Calendar__Day e devono essere .enabled per essere cliccabili
- La navigazione mesi usa .Calendar__Navigation__NextMonth/.Calendar__Navigation__PrevMonth
- Possono esserci attributi data-date sui giorni del calendario
- Il calendario potrebbe avere un container con classe .Calendar o .DatePicker

Rispondi SOLO con un JSON in questo formato:
{
  "selectors": {
    "checkinDate": "selector CSS per aprire selezione check-in",
    "checkoutDate": "selector CSS per aprire selezione check-out", 
    "adultsSelector": "selector CSS per numero adulti",
    "childrenSelector": "selector CSS per numero bambini (se presente)",
    "searchButton": "selector CSS per bottone ricerca"
  },
  "dateSelectionMethod": "fill|click|calendar",
  "calendarSelectors": {
    "dateCell": "selector per celle data nel calendario (es: [data-date='2025-07-28'])",
    "monthNavNext": "selector per andare al mese successivo",
    "monthNavPrev": "selector per andare al mese precedente",
    "closeCalendar": "selector per chiudere il calendario"
  },
  "instructions": "Istruzioni dettagliate su come selezionare le date",
  "confidence": "alto/medio/basso"
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Sei un esperto di web scraping e automazione. Analizzi HTML per trovare i selettori CSS corretti. Rispondi sempre con JSON valido.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    const result = parseGptJson(response.choices[0].message.content);
    logger.info('GPT search page analysis completed', { result });
    
    return result;
  } catch (error) {
    logger.error('Error analyzing search page:', error);
    throw new Error('Failed to analyze search page with AI');
  }
}

async function analyzeRoomsPage(html) {
  logger.info('Analyzing rooms page with GPT');
  
  const cleanedHtml = cleanHtml(html);
  
  const prompt = `
Analizza questo HTML di una pagina SimpleBooking per estrarre informazioni sulle camere disponibili dopo una ricerca.

Piattaforma: SimpleBooking (simplebooking.it)
HTML:
${cleanedHtml}

Cerca specificamente elementi SimpleBooking per le camere:
- Container camere: classi come .RoomsList, .Room, .Accommodation, .room-item, .booking-room
- Nome camera: classi come .RoomName, .room-title, .accommodation-name
- Prezzo: classi come .Price, .room-price, .rate, .amount, elementi con €, EUR
- Pulsanti selezione: classi come .SelectRoom, .BookNow, .book-button, .select-button
- Descrizioni: classi come .RoomDescription, .room-details, .amenities
- Codici camera: attributi data-room-id, data-accommodation-id, id univoci

Elementi tipici SimpleBooking da cercare:
- Div/section con classe contenente "Room", "Accommodation", "Rate"
- Link/button con "Prenota", "Seleziona", "Book", "Select"
- Testi con prezzi (numeri seguiti da €, EUR, euro)
- Attributi data-* contenenti ID camera o rate

ATTENZIONE: Se la pagina mostra ancora il form di ricerca o un calendario, significa che i risultati non sono ancora caricati.
Se vedi elementi come .SearchWidget, .Calendar, senza risultati camera, indica che bisogna aspettare o riprovare.

Rispondi SOLO con un JSON in questo formato:
{
  "rooms": [
    {
      "id": "identificatore unico camera (da data-* attribute o testo)",
      "name": "nome camera",
      "price": "prezzo per notte (solo numero)", 
      "currency": "EUR",
      "description": "breve descrizione",
      "features": ["caratteristica1", "caratteristica2"],
      "selector": "selector CSS per selezionare questa camera (button, link)",
      "available": true
    }
  ],
  "message": "Messaggio descrittivo sui risultati",
  "totalRooms": "numero totale camere trovate",
  "pageStatus": "loading|results|error"
}

Se non trovi camere ma vedi ancora elementi di ricerca, imposta pageStatus: "loading".
Se non ci sono camere disponibili ma la pagina è caricata, imposta pageStatus: "results".
`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Sei un esperto di estrazione dati da HTML. Estrai informazioni precise sulle camere hotel. Rispondi sempre con JSON valido.'
        },
        {
          role: 'user',
          content: prompt  
        }
      ],
      temperature: 0.1,
      max_tokens: 3000
    });

    const result = parseGptJson(response.choices[0].message.content);
    logger.info('GPT rooms analysis completed', { roomsFound: result.rooms?.length || 0 });
    
    return result;
  } catch (error) {
    logger.error('Error analyzing rooms page:', error);
    throw new Error('Failed to analyze rooms page with AI');
  }
}

async function analyzeRoomSelection(html, roomId) {
  logger.info('Analyzing room selection with GPT', { roomId });
  
  const cleanedHtml = cleanHtml(html);
  
  const prompt = `
Analizza questo HTML per trovare come selezionare la camera con ID: ${roomId}

HTML:
${cleanedHtml}

Trova il selettore CSS per cliccare e selezionare questa specifica camera.

Rispondi SOLO con un JSON in questo formato:
{
  "selectRoomButton": "selector CSS per selezionare la camera",
  "instructions": "istruzioni aggiuntive se necessarie",
  "confidence": "alto/medio/basso"
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Sei un esperto di automazione web. Trova i selettori corretti per interagire con elementi HTML.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 1000
    });

    const result = parseGptJson(response.choices[0].message.content);
    logger.info('GPT room selection analysis completed', { result });
    
    return result;
  } catch (error) {
    logger.error('Error analyzing room selection:', error);
    throw new Error('Failed to analyze room selection with AI');
  }
}

async function analyzeBookingForm(html, personalData) {
  logger.info('Analyzing booking form with GPT');
  
  const cleanedHtml = cleanHtml(html);
  
  const prompt = `
Analizza questo HTML per trovare i selettori CSS per compilare il form di prenotazione.

Dati da inserire:
- Nome: ${personalData.firstName}
- Cognome: ${personalData.lastName} 
- Email: ${personalData.email}
- Telefono: ${personalData.phone}
- Numero carta: ${personalData.cardNumber}
- CVV: ${personalData.cvv}
- Scadenza: ${personalData.expiryMonth}/${personalData.expiryYear}

HTML:
${cleanedHtml}

Rispondi SOLO con un JSON in questo formato:
{
  "firstName": "selector CSS campo nome",
  "lastName": "selector CSS campo cognome",
  "email": "selector CSS campo email", 
  "phone": "selector CSS campo telefono",
  "cardNumber": "selector CSS campo numero carta",
  "cvv": "selector CSS campo CVV",
  "expiryMonth": "selector CSS campo mese scadenza",
  "expiryYear": "selector CSS campo anno scadenza", 
  "acceptCheck": "selector CSS checkbox accettazione condizioni",
  "submitButton": "selector CSS bottone conferma prenotazione",
  "instructions": "istruzioni aggiuntive"
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Sei un esperto di form HTML. Identifica i selettori corretti per compilare form di prenotazione hotel.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    const result = parseGptJson(response.choices[0].message.content);
    logger.info('GPT booking form analysis completed', { result });
    
    return result;
  } catch (error) {
    logger.error('Error analyzing booking form:', error);
    throw new Error('Failed to analyze booking form with AI');
  }
}

async function analyzeBookingResult(html) {
  logger.info('Analyzing booking result with GPT');
  
  const cleanedHtml = cleanHtml(html);
  
  const prompt = `
Analizza questo HTML per determinare se la prenotazione è andata a buon fine o se c'è stato un errore.

HTML:
${cleanedHtml}

Cerca indicazioni di:
- Prenotazione confermata (numero di prenotazione, conferma successo)
- Errori di pagamento (carta rifiutata, fondi insufficienti, etc.)
- Altri errori o problemi

Rispondi SOLO con un JSON in questo formato:
{
  "success": true/false,
  "message": "messaggio descrittivo del risultato",
  "bookingReference": "numero prenotazione se trovato, null altrimenti",
  "error": "descrizione errore se presente, null altrimenti",
  "errorType": "payment/validation/system/null"
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Sei un esperto di analisi risultati form web. Determina se una transazione è riuscita o fallita.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 1500
    });

    const result = parseGptJson(response.choices[0].message.content);
    logger.info('GPT booking result analysis completed', { result });
    
    return result;
  } catch (error) {
    logger.error('Error analyzing booking result:', error);
    throw new Error('Failed to analyze booking result with AI');
  }
}

// New function with precise selectors based on real DOM structure
async function getSearchPageSelectorsFromRealDOM(html, checkInDate, checkOutDate) {
  logger.info('Using real DOM-based selectors for search page');
  
  // Based on the actual HTML provided, we now have the precise selectors
  const selectors = {
    "selectors": {
      "checkinDate": "button.OpenPanelCTA.SearchWidget__Calendar_CTA",
      "checkoutDate": "button.OpenPanelCTA.SearchWidget__Calendar_CTA",
      "adultsSelector": "button.OpenPanelCTA.SearchWidget__Allocations_CTA",
      "searchButton": "a#PanelSearchWidgetCTA"
    },
    "dateSelectionMethod": "calendar",
    "calendarSelectors": {
      "calendarPanel": "div.SearchWidget__CalendarPanel",
      "leftCalendar": "div.Calendar__Month:first-of-type",
      "rightCalendar": "div.Calendar__Month:last-of-type",
      "dateCell": "button.Calendar__Day.enabled",
      "dateCellText": "span[aria-hidden='true']",
      "monthNavNext": "button.Calendar__Navigation__NextMonth",
      "monthNavPrev": "button.Calendar__Navigation__PrevMonth",
      "monthHeader": "p.e13n5vxp3.Paragraph b",
      "monthButton": "button.ltr-146b9ar.e13n5vxp4",
      "availabilityFull": ".availability_full",
      "availabilityCheckIn": ".availability_check_in"
    },
    "instructions": "Click calendar button, navigate to correct months, select dates by clicking on day buttons",
    "confidence": "alto"
  };
  
  logger.info('Real DOM selectors prepared', { selectors });
  return selectors;
}

// Cookie consent selectors for Klaro
const COOKIE_SELECTORS = {
  cookieAcceptButton: '.cm-btn-accept, button:has-text("Accetta"), button:has-text("Accept"), .klaro .cm-btn-accept-all, [data-klaro-action="accept-all"]',
  cookieBanner: '.klaro, .cookie-banner, .cm-popup, [data-klaro]',
  cookieDeclineButton: '.cm-btn-decline, [data-klaro-action="decline-all"]'
};

// Selettori per la pagina dei risultati di disponibilità
const AVAILABILITY_RESULTS_SELECTORS = {
  // Container principale dei risultati
  resultsContainer: '.AvailabilityResult, .RoomsResult, .ewozsd42',
  
  // Loader per attendere risultati
  loader: '.QuarterRingLoader, .e47q4xm0, .ltr-jispw8, .e1v89k2u3',
  
  // Testo del loader
  loaderText: '.e1v89k2u0, :contains("Controlla disponibilità")',
  
  // Singola camera/opzione
  roomCard: '.RoomCard, .RoomResultBlock, .ekc2wag12, .eio1k2u2',
  
  // Titolo della camera
  roomTitle: '.RoomCard h3, .ekc2wag9 h3, h3.Heading strong',
  
  // Prezzo della camera - selettori basati sulla struttura HTML reale SimpleBooking
  roomPrice: '.Prices .mainAmount span, .eiup2eu1 span, .mainAmount span, [translate="no"] span',
  
  // Bottone "Info e prenota" principale
  mainBookButton: '.RoomCard_CTA, .ekc2wag2, button:contains("Info e prenota")',
  
  // Bottoni "Prenota" nelle opzioni tariffarie
  bookButton: '.RoomOption_CTA, .e16r10jm0, button:contains("Prenota")',
  
  // Espandi opzioni della camera
  expandOptionsButton: '.RoomCard_CTA[aria-expanded="false"], button:has(svg[title="chevron-up"])',
  
  // Opzioni tariffarie (quando espanse)
  rateOptions: '.RateWithOptions, .e1sl87534',
  
  // Singola opzione tariffaria
  rateOption: '.RoomOption, .e16r10jm8',
  
  // Titolo tariffa
  rateTitle: '.e18qkw5q3, h4.Paragraph strong',
  
  // Prezzo tariffa
  ratePrice: '.mainAmount, .eiup2eu2',
  
  // Descrizione camera
  roomDescription: '.ekc2wag6, .RoomCard .Paragraph',
  
  // Features/servizi della camera
  roomFeatures: '.RoomFeature, .e10k6jbs0',
  
  // Badge offerte speciali
  specialOfferBadge: '.Badge:contains("Offerta speciale"), .e1jssjhy1:contains("Offerta speciale")',
  
  // Indicatori di disponibilità limitata
  limitedAvailability: '.enongdq2, :contains("Ne resta solo"), :contains("Ne restano solo")',
  
  // Politica di cancellazione
  cancellationPolicy: '.Rate__CancellationPolicy, .e18qkw5q0'
};

// Selettori per la pagina di inserimento dati cliente
const CUSTOMER_DATA_SELECTORS = {
  // Campi principali del form
  firstName: 'input[name="name"], input#_rb_, input[name="firstName"]',
  lastName: 'input[name="lastName"], input#_re_, input[name="surname"]',
  email: 'input[name="email"], input#_rh_, input[type="email"]:first-of-type',
  emailConfirm: 'input[name="emailConfirm"], input#_rk_, input[type="email"]:nth-of-type(2)',
  phone: 'input[name="phone"], input[name="telephone"], #phone, [name*="phone"]',
  notes: 'textarea[name="notes"], textarea#_rn_, textarea[name="requests"]',
  
  // Checkbox
  privacyCheckbox: 'input[name="privacyPolicyAcceptance"], input#_rt_, input[name="privacy"]',
  newsletterCheckbox: 'input[name="newsletterSubscription"], input#_rq_, input[name="newsletter"]',
  
  // Bottoni
  continueButton: 'button.CustomerDataCollectionPage_CTA, button[class*="continue"], button[class*="Continue"]',
  backButton: '.DesktopSidebar__BackButton, button[class*="back"], button[class*="Back"]',
  modifySearchButton: '.DesktopSidebar__ModifySearch, button[class*="modify"], button[class*="Modify"]',
  
  // Login sociale
  socialLogin: {
    facebook: 'button[class*="FACEBOOK"], .SocialSignInButton__FACEBOOK, button.elx78260:first-child',
    google: 'button[class*="GOOGLE"], .SocialSignInButton__GOOGLE, button.elx78260:last-child'
  },
  
  // Link alternative
  hasAccountLink: 'button:contains("Ho già un account"), .CTA:contains("account")',
  privacyPolicyLink: 'button:contains("Privacy Policy"), .CTA:contains("Privacy")',
  
  // Elementi informativi
  bookingSummary: '.ReservationSummary, .Cart, .e1dfdjmq10',
  totalPrice: '.Cart__Totals .mainAmount, .e1risg603 .mainAmount',
  selectedRoom: '.Cart__Room, .e104199m1',
  roomName: '.Cart__Room__Name, .e1m2olwc1',
  
  // Sezione vantaggi prenotazione diretta
  benefitsSection: '.BenefitsOfDirectBooking, .em4920p6',
  guaranteeBadge: '.Badge:contains("ufficiale"), .e1jssjhy1'
};

// Selettori per la pagina di completamento prenotazione (garantire la prenotazione)
const BOOKING_COMPLETION_SELECTORS = {
  // Campo numero di telefono - basato sulla struttura HTML reale
  mobilePhone: 'input[name="mobilePhone"], input#_reo_',
  mobilePhoneLabel: 'label[for="_reo_"]',
  
  // Selettori per i metodi di pagamento - IDs e valori specifici dalla pagina reale
  creditCardRadio: 'input[name="paymentMethodId"][value="104"], input#_ret_',
  bankTransferRadio: 'input[name="paymentMethodId"][value="1"], input#_rev_',
  
  // Campi carta di credito - nomi e IDs dalla struttura HTML reale
  cardNumber: 'input[name="creditCard.number"], input#_rf7_',
  cardHolder: 'input[name="creditCard.holder"], input#_rfa_', 
  cardExpiry: 'input[name="creditCard.expiry"], input#_rfd_',
  // CVV non presente nell'HTML fornito - manteniamo selettori generici come fallback
  cardCvv: 'input[name="creditCard.cvv"], input[id*="cvv"], input[id*="cvc"], .card-cvv input',
  
  // Checkbox accettazione condizioni (obbligatorio) - ID specifico
  termsCheckbox: 'input[name="bookinkAndPrivacyPoliciesAcceptance"], input#_rf4_',
  termsLabel: 'label[for="_rf4_"]',
  
  // Checkbox newsletter (opzionale) - ID specifico 
  newsletterCheckbox: 'input[name="newsletterSubscription"], input#_rf1_',
  newsletterLabel: 'label[for="_rf1_"]',
  
  // Bottoni prenotazione - classe specifica dalla pagina reale
  finalBookingButton: 'button.GuaranteeDataCollectionPage_CTA, button:contains("Prenota")',
  sidebarBookingButton: 'button.DesktopSidebar_CTA',
  
  // Container del form di pagamento
  paymentMethodsForm: '.PaymentMethodsForm, .e1qa5vpx2',
  creditCardContainer: '.BookingMediumTypeContainer, .e1e67odw2',
  creditCardInputSection: '.PaymentMethodInput, .e10m73qo7',
  
  // Indicatori di caricamento o successo
  loadingIndicator: '.loading, .spinner, [class*="loading"]',
  successMessage: '.success, .confirmation, [class*="success"], [class*="confirmation"]',
  errorMessage: '.error, .alert, [class*="error"], [class*="alert"]',
  
  // Links alle condizioni - classi specifiche dalla pagina
  conditionsLink: '.sb-condition-popup-link, a[role="button"]:contains("condizioni")',
  privacyLink: '.sb-privacy-popup-link, a[role="button"]:contains("Privacy")',
  
  // Selettori per pagamento sicuro
  sslEncryption: '.SSLDataEncryption, .epts9b60',
  securityLogos: 'img[alt="comodo secure"], img[alt="pci dss"]',
  
  // Selettori per iframe/popup del pagamento (potrebbero apparire)
  paymentFrame: 'iframe[src*="payment"], iframe[src*="card"], .payment-frame',
  paymentModal: '.payment-modal, .card-modal, [class*="payment"][class*="modal"]',
  
  // Elementi per la pagina di risultato finale
  bookingConfirmation: '.booking-confirmed, .confirmation-page, h1:contains("Prenotazione confermata")',
  bookingReference: '.booking-reference, .confirmation-number, [class*="booking"][class*="number"]',
  bookingError: '.booking-error, .payment-error, .error-message'
};

// Selettori per la pagina di pagamento con carta di credito (deprecato, sostituito da BOOKING_COMPLETION_SELECTORS)
const PAYMENT_PAGE_SELECTORS = {
  // Dati già inseriti (disabilitati)
  customerDataDisabled: {
    firstName: 'input#_r3c_[disabled]',
    lastName: 'input#_r3f_[disabled]',
    email: 'input#_r3i_[disabled]'
  },
  
  // Campo telefono/cellulare
  phoneField: 'input[name="mobilePhone"], input#_r3l_',
  
  // Metodi di pagamento radio buttons
  paymentMethods: {
    creditCard: 'input#_r3q_[value="104"]',
    bankTransfer: 'input#_r3s_[value="1"]'
  },
  
  // Campi carta di credito
  creditCard: {
    number: 'input[name="creditCard.number"], input#_r45_',
    holder: 'input[name="creditCard.holder"], input#_r48_',
    expiry: 'input[name="creditCard.expiry"], input#_r4b_',
    // CVV non sembra essere presente in questo form
  },
  
  // Checkbox obbligatori
  checkboxes: {
    newsletter: 'input[name="newsletterSubscription"], input#_r3u_',
    termsAndPrivacy: 'input[name="bookinkAndPrivacyPoliciesAcceptance"], input#_r41_'
  },
  
  // Bottoni finali
  bookButton: 'button.GuaranteeDataCollectionPage_CTA, button:contains("Prenota")',
  sidebarBookButton: 'button.DesktopSidebar_CTA',
  
  // Elementi informativi
  depositAmount: '#deposit, .e10m73qo5:contains("Deposito")',
  securityInfo: '.e10m73qo1, .SafelyAndWithoutCommissions',
  
  // Links condizioni
  conditionsLink: '.sb-condition-popup-link',
  privacyLink: '.sb-privacy-popup-link',
  
  // Informazioni di sicurezza
  sslEncryption: '.SSLDataEncryption, .epts9b60',
  securityLogos: 'img[alt="comodo secure"], img[alt="pci dss"]'
};

// Function to analyze availability results page
async function analyzeAvailabilityResults(html) {
  logger.info('Analyzing availability results page with GPT');
  
  const cleanedHtml = cleanHtml(html);
  
  const prompt = `
Analizza questo HTML di una pagina SimpleBooking con i risultati di disponibilità per identificare le opzioni di camere e tariffe.

Piattaforma: SimpleBooking (simplebooking.it)
HTML:
${cleanedHtml}

Cerca specificamente:
- Container con risultati camere (classi come .AvailabilityResult, .RoomsResult)
- Cards delle camere (classi come .RoomCard, .RoomResultBlock)
- Prezzi (elementi con €, classi .mainAmount, .Prices)
- Bottoni "Info e prenota" o "Prenota" per selezionare camere/tariffe
- Opzioni tariffarie espandibili (bottoni con frecce, aria-expanded)
- Titoli delle camere e descrizioni
- Badge per offerte speciali
- Loader o spinner (se la pagina sta ancora caricando)

IMPORTANTE: 
- Se vedi un loader/spinner attivo, indica pageStatus: "loading"
- Se vedi camere con prezzi e bottoni di prenotazione, indica pageStatus: "results"
- Identifica sia i bottoni principali "Info e prenota" che quelli nelle opzioni tariffarie "Prenota"

Rispondi SOLO con un JSON in questo formato:
{
  "rooms": [
    {
      "id": "identificatore unico camera",
      "name": "nome camera",
      "price": "prezzo minimo mostrato (solo numero)",
      "currency": "EUR",
      "description": "breve descrizione",
      "features": ["caratteristica1", "caratteristica2"],
      "mainBookSelector": "selector CSS per bottone Info e prenota principale",
      "expandSelector": "selector CSS per espandere opzioni (se presente)",
      "rateOptions": [
        {
          "name": "nome tariffa",
          "price": "prezzo (solo numero)",
          "bookSelector": "selector CSS per bottone Prenota di questa tariffa",
          "cancellable": true/false,
          "description": "descrizione tariffa"
        }
      ],
      "available": true,
      "limitedAvailability": "testo se disponibilità limitata, null altrimenti"
    }
  ],
  "message": "Descrizione dello stato della pagina",
  "totalRooms": "numero totale camere trovate",
  "pageStatus": "loading|results|error",
  "loaderVisible": true/false
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Sei un esperto di estrazione dati da pagine di risultati hotel. Analizza HTML per trovare camere, prezzi e opzioni di prenotazione. Rispondi sempre con JSON valido.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 4000
    });

    const result = parseGptJson(response.choices[0].message.content);
    logger.info('GPT availability results analysis completed', { 
      roomsFound: result.rooms?.length || 0,
      pageStatus: result.pageStatus
    });
    
    return result;
  } catch (error) {
    logger.error('Error analyzing availability results page:', error);
    throw new Error('Failed to analyze availability results page with AI');
  }
}

// Function to wait for availability results to load - OPTIMIZED
async function waitForAvailabilityResults(page, maxWaitTime = 8000) {
  logger.info('Waiting for availability results to load (optimized)');
  
  const startTime = Date.now();
  let consecutiveSuccesses = 0;
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Fast parallel checks with shorter timeouts
      const checks = await Promise.allSettled([
        // Check for room cards with the selectors you provided
        page.isVisible('.RoomCard, .RoomResultBlock, .ekc2wag12, .eio1k2u2', { timeout: 500 }),
        // Check for price elements
        page.isVisible('.mainAmount, .eiup2eu1', { timeout: 300 }),
        // Check for book buttons
        page.isVisible('button:contains("Info e prenota"), button:contains("Prenota")', { timeout: 300 }),
        // Check if loader is gone
        page.isVisible('.QuarterRingLoader, .e47q4xm0, .ltr-jispw8, .e1v89k2u3', { timeout: 200 }).then(visible => !visible)
      ]);
      
      const roomsVisible = checks[0].status === 'fulfilled' && checks[0].value;
      const pricesVisible = checks[1].status === 'fulfilled' && checks[1].value;
      const buttonsVisible = checks[2].status === 'fulfilled' && checks[2].value;
      const loaderGone = checks[3].status === 'fulfilled' && checks[3].value;
      
      // If we have rooms AND (prices OR buttons), consider it ready
      if (roomsVisible && (pricesVisible || buttonsVisible)) {
        consecutiveSuccesses++;
        // Require 2 consecutive successes to avoid false positives
        if (consecutiveSuccesses >= 2) {
          logger.info('Availability results loaded successfully (fast)', {
            roomsVisible,
            pricesVisible,
            buttonsVisible,
            loaderGone,
            elapsed: Date.now() - startTime
          });
          return { success: true, status: 'results' };
        }
      } else {
        consecutiveSuccesses = 0;
      }
      
      // Much shorter wait between checks
      await page.waitForTimeout(500);
      
    } catch (error) {
      logger.debug('Waiting for results...', { 
        elapsed: Date.now() - startTime,
        error: error.message 
      });
    }
  }
  
  logger.warn('Fast timeout waiting for availability results, proceeding anyway');
  // Even if timeout, return success to try to analyze whatever is on the page
  return { success: true, status: 'timeout_but_proceed' };
}

// Function to check and handle cookie consent - OPTIMIZED
async function handleCookieConsent(page) {
  logger.info('Checking for cookie consent banners (fast)');
  
  try {
    // Much shorter wait for banner to appear
    await page.waitForTimeout(800);
    
    // Check if cookie banner is present with shorter timeout
    const bannerVisible = await page.isVisible(COOKIE_SELECTORS.cookieBanner, { timeout: 1500 });
    
    if (bannerVisible) {
      logger.info('Cookie consent banner detected, accepting cookies');
      
      // Try to click accept button with shorter timeout
      const acceptClicked = await page.click(COOKIE_SELECTORS.cookieAcceptButton, { timeout: 2000 });
      
      if (acceptClicked) {
        logger.info('Successfully accepted cookies');
        await page.waitForTimeout(300); // Much shorter wait for banner to disappear
      } else {
        logger.warn('Could not click cookie accept button');
      }
    } else {
      logger.info('No cookie consent banner found');
    }
  } catch (error) {
    logger.info('Cookie consent handling completed (no banner found or already dismissed)');
  }
}

// Function to analyze customer data collection page
async function analyzeCustomerDataPage(html) {
  logger.info('Analyzing customer data collection page with GPT');
  
  const cleanedHtml = cleanHtml(html);
  
  const prompt = `
Analizza questo HTML di una pagina SimpleBooking per identificare i selettori CSS per compilare il form di inserimento dati cliente.

Piattaforma: SimpleBooking (simplebooking.it)
HTML:
${cleanedHtml}

Cerca specificamente:
- Campi input per dati personali (nome, cognome, email, conferma email)
- Campo per richieste speciali/note
- Checkbox per privacy policy e newsletter
- Bottone per continuare/procedere
- Opzioni di login sociale (Facebook, Google)
- Link "Ho già un account" o simili
- Sezione riassunto prenotazione nella sidebar
- Prezzo totale e dettagli camera selezionata

ELEMENTI TIPICI SIMPLEBOOKING da cercare:
- Input con ID che iniziano con underscore (es: #_rb_, #_re_)
- Classi come .CustomerDataCollectionPage_CTA per il bottone continua
- Classi .SocialSignInButton per login sociale
- Classi .ReservationSummary o .Cart per il riassunto
- Input con name="name", "lastName", "email", "emailConfirm"
- Textarea con name="notes" per richieste speciali
- Checkbox con name="privacyPolicyAcceptance", "newsletterSubscription"

Rispondi SOLO con un JSON in questo formato:
{
  "formFields": {
    "firstName": "selector CSS campo nome",
    "lastName": "selector CSS campo cognome",
    "email": "selector CSS campo email",
    "emailConfirm": "selector CSS campo conferma email",
    "phone": "selector CSS campo telefono (se presente)",
    "notes": "selector CSS campo richieste speciali"
  },
  "checkboxes": {
    "privacy": "selector CSS checkbox privacy policy",
    "newsletter": "selector CSS checkbox newsletter"
  },
  "buttons": {
    "continue": "selector CSS bottone continua",
    "facebookLogin": "selector CSS bottone login Facebook",
    "googleLogin": "selector CSS bottone login Google",
    "hasAccount": "selector CSS link ho già account"
  },
  "summary": {
    "container": "selector CSS container riassunto prenotazione",
    "totalPrice": "selector CSS prezzo totale",
    "roomName": "selector CSS nome camera",
    "dates": "selector CSS date soggiorno"
  },
  "pageType": "customer_data",
  "isLoaded": true,
  "message": "Descrizione dello stato del form"
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Sei un esperto di analisi form HTML per automazione web. Identifica i selettori corretti per compilare form di raccolta dati cliente su siti di prenotazione hotel. Rispondi sempre con JSON valido.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 3000
    });

    const result = parseGptJson(response.choices[0].message.content);
    logger.info('GPT customer data page analysis completed', { result });
    
    return result;
  } catch (error) {
    logger.error('Error analyzing customer data page:', error);
    throw new Error('Failed to analyze customer data page with AI');
  }
}

// Function to fill customer data form
async function fillCustomerDataForm(page, customerData, selectors) {
  logger.info('Filling customer data form', { email: customerData.email });
  
  try {
    // Fill first name
    if (selectors.formFields.firstName && customerData.firstName) {
      await page.waitForSelector(selectors.formFields.firstName, { timeout: 5000 });
      await page.fill(selectors.formFields.firstName, customerData.firstName);
      logger.info('First name filled');
    }
    
    // Fill last name
    if (selectors.formFields.lastName && customerData.lastName) {
      await page.waitForSelector(selectors.formFields.lastName, { timeout: 5000 });
      await page.fill(selectors.formFields.lastName, customerData.lastName);
      logger.info('Last name filled');
    }
    
    // Fill email
    if (selectors.formFields.email && customerData.email) {
      await page.waitForSelector(selectors.formFields.email, { timeout: 5000 });
      await page.fill(selectors.formFields.email, customerData.email);
      logger.info('Email filled');
    }
    
    // Fill email confirmation
    if (selectors.formFields.emailConfirm && customerData.email) {
      await page.waitForSelector(selectors.formFields.emailConfirm, { timeout: 5000 });
      await page.fill(selectors.formFields.emailConfirm, customerData.email);
      logger.info('Email confirmation filled');
    }
    
    // Fill phone if provided
    if (selectors.formFields.phone && customerData.phone) {
      try {
        await page.waitForSelector(selectors.formFields.phone, { timeout: 3000 });
        await page.fill(selectors.formFields.phone, customerData.phone);
        logger.info('Phone filled');
      } catch (error) {
        logger.warn('Phone field not found or not fillable');
      }
    }
    
    // Fill special requests/notes if provided
    if (selectors.formFields.notes && customerData.notes) {
      try {
        await page.waitForSelector(selectors.formFields.notes, { timeout: 3000 });
        await page.fill(selectors.formFields.notes, customerData.notes);
        logger.info('Notes filled');
      } catch (error) {
        logger.warn('Notes field not found or not fillable');
      }
    }
    
    // Check privacy policy checkbox
    if (selectors.checkboxes.privacy) {
      try {
        await page.waitForSelector(selectors.checkboxes.privacy, { timeout: 3000 });
        const isChecked = await page.isChecked(selectors.checkboxes.privacy);
        if (!isChecked) {
          await page.check(selectors.checkboxes.privacy);
          logger.info('Privacy policy checkbox checked');
        }
      } catch (error) {
        logger.warn('Privacy checkbox not found or not checkable');
      }
    }
    
    // Optionally check newsletter checkbox
    if (selectors.checkboxes.newsletter && customerData.acceptNewsletter) {
      try {
        await page.waitForSelector(selectors.checkboxes.newsletter, { timeout: 3000 });
        const isChecked = await page.isChecked(selectors.checkboxes.newsletter);
        if (!isChecked) {
          await page.check(selectors.checkboxes.newsletter);
          logger.info('Newsletter checkbox checked');
        }
      } catch (error) {
        logger.warn('Newsletter checkbox not found or not checkable');
      }
    }
    
    logger.info('Customer data form filled successfully');
    return { success: true, message: 'Form filled successfully' };
    
  } catch (error) {
    logger.error('Error filling customer data form:', error);
    throw new Error(`Failed to fill customer data form: ${error.message}`);
  }
}

// Generic overlay closer to dismiss popups/modals that can block clicks
async function closeOverlays(page, options = { aggressive: false, maxMs: 800 }) {
  try {
    const start = Date.now();
    const maxMs = typeof options.maxMs === 'number' ? options.maxMs : 800;
    const candidates = [
      '.cookie-notice', '.klaro', '.cm-popup', '[data-klaro]',
      '.cookie-banner', '.cookie-consent', '.cookie-consent-banner',
      '.modal', '.modal.show', '.ReactModal__Overlay', '.overlay', '[role="dialog"]',
      '[class*="overlay"][class*="visible"], [class*="modal"][class*="open"]'
    ];

    for (const sel of candidates) {
      if (Date.now() - start > maxMs) break;
      const loc = page.locator(sel).first();
      const visible = await loc.isVisible({ timeout: 50 }).catch(() => false);
      if (!visible) continue;

      const actions = [
        'button:has-text("Accetta")',
        'button:has-text("Accept")',
        'button:has-text("Accetta tutto")',
        'button:has-text("Consent")',
        'button:has-text("Chiudi")',
        'button:has-text("Ok")',
        'button:has-text("OK")',
        'button:has-text("Continua")',
        'a:has-text("Chiudi")',
        '.cm-btn-accept, .cm-btn-accept-all',
        '.cm-btn-decline, [data-klaro-action="decline-all"]',
        '[data-klaro-action="accept-all"]',
        '.close, .modal-close, [aria-label="Close"], button[aria-label="close"]'
      ];

      for (const act of actions) {
        if (Date.now() - start > maxMs) break;
        const btn = page.locator(`${sel} ${act}`).first();
        try {
          if (await btn.isVisible({ timeout: 50 }).catch(() => false)) {
            await btn.click({ timeout: 200 }).catch(() => {});
          }
        } catch {}
      }
    }

    // Optional last resort
    if (options.aggressive) {
      await page.evaluate(() => {
        const hide = (el) => { try { el.style.setProperty('display','none','important'); el.style.setProperty('visibility','hidden','important'); el.style.setProperty('opacity','0','important'); } catch(e){} };
        document.querySelectorAll('.cookie-notice, .klaro, .cm-popup, [data-klaro], .cookie-banner, .cookie-consent, .modal, .ReactModal__Overlay, .overlay, [role="dialog"]').forEach(hide);
      }).catch(() => {});
    }
  } catch (e) {
    // Never block on overlays
  }
}

module.exports = {
  analyzeSearchPage,
  analyzeRoomsPage,
  analyzeRoomSelection,
  analyzeBookingForm,
  analyzeBookingResult,
  getSearchPageSelectorsFromRealDOM,
  handleCookieConsent,
  analyzeAvailabilityResults,
  waitForAvailabilityResults,
  analyzeCustomerDataPage,
  fillCustomerDataForm,
  COOKIE_SELECTORS,
  AVAILABILITY_RESULTS_SELECTORS,
  CUSTOMER_DATA_SELECTORS,
  BOOKING_COMPLETION_SELECTORS,
  closeOverlays
};
