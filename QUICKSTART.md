# 🚀 Quick Start Guide

Questa guida ti aiuterà ad avviare il sistema di automazione hotel booking in **meno di 5 minuti**.

## ⚡ Setup Ultra Rapido

### 1. Installa Dipendenze
```bash
# Installa tutto in un comando
npm run install:all

# Installa browser Playwright
cd backend && npx playwright install && cd ..
```

### 2. Configurazione Completata
Il file `.env` è già configurato con:
- ✅ **OpenAI API Key**: `sk-proj-dHDDQFGSHkxAKaydnjEU...`
- ✅ **Target Hotel**: SimpleBooking Palazzo Vitturi
- ✅ **Browser**: Modalità visibile per debug

### 3. Avvia il Sistema
```bash
# Un comando per tutto
npm run dev
```

Questo avvierà:
- 🖥️ **Backend** su http://localhost:3001
- ⚛️ **Frontend** su http://localhost:5173

## 🎯 Test Immediato

1. **Apri il Browser**: http://localhost:5173

2. **Usa i Dati Pre-compilati** (già settati):
   - Check-in: Oggi
   - Check-out: Domani  
   - Adulti: 2
   - Bambini: 0

3. **Clicca "Avvia Automazione"**

4. **Osserva la Magia**:
   - 🤖 GPT-4 analizza la pagina SimpleBooking
   - 🎯 Playwright compila i campi automaticamente
   - 📊 Estrae le camere disponibili
   - 💳 Simula la prenotazione

## 📱 Cosa Vedrai

### Step 1: Ricerca
```
🔍 Analisi pagina hotel in corso...
   ↳ GPT-4 identifica selettori CSS
   ↳ Playwright compila le date
   ↳ Screenshot salvato
```

### Step 2: Camere 
```
🏨 Estrazione camere disponibili...
   ↳ GPT-4 analizza risultati ricerca
   ↳ Estrae nome, prezzo, caratteristiche
   ↳ Mostra opzioni nel frontend
```

### Step 3: Prenotazione
```
💳 Prenotazione con dati test...
   ↳ Dati precompilati (carta finta)
   ↳ GPT-4 compila il form
   ↳ Risultato finale
```

## 🔧 Debug in Tempo Reale

Mentre il sistema funziona:

```bash
# Terminal separato - Log Backend
tail -f backend/logs/booking.log

# Oppure solo errori
tail -f backend/logs/error.log
```

**Screenshot automatici** salvati in:
- `backend/logs/search-{sessionId}.png`
- `backend/logs/rooms-{sessionId}.png`  
- `backend/logs/booking-final-{sessionId}.png`

## ⚡ Dati di Test Precaricati

Il sistema usa automaticamente:

```javascript
// Carta di credito FAKE (nessun pagamento reale)
cardNumber: "4111111111111111"  // Visa test
expiryMonth: "12"
expiryYear: "2026"
cvv: "123"

// Dati personali
firstName: "Mario"
lastName: "Rossi" 
email: "mario.rossi@example.com"
phone: "+39 123 456 7890"
```

## 🚨 Risoluzione Problemi Comuni

### Backend non si avvia
```bash
# Verifica OpenAI API Key
grep OPENAI_API_KEY .env

# Verifica porte
lsof -ti:3001
lsof -ti:5173
```

### GPT-4 Errors
- ✅ API Key valida e con crediti
- ✅ Rate limiting OpenAI (max 3 richieste/minuto)

### Playwright Crashes
```bash
# Re-installa browser
cd backend
rm -rf node_modules/.cache
npx playwright install
```

### SimpleBooking Changes
Il sito potrebbe cambiare HTML → GPT-4 dovrebbe adattarsi automaticamente!

## 🎮 Modalità Demo

Per una demo veloce senza browser visibile:

1. **Imposta headless**:
```bash
# In .env
HEADLESS=true
```

2. **Avvia**:
```bash
npm run dev
```

3. **Test API diretta**:
```bash
curl -X POST http://localhost:3001/api/booking/start-search \
  -H "Content-Type: application/json" \
  -d '{"checkinDate":"2024-01-15","checkoutDate":"2024-01-17","adults":2,"children":0}'
```

## ✅ Ready to Go!

Il sistema è **pronto all'uso** con:
- 🤖 GPT-4 configurato
- 🎯 SimpleBooking target attivo
- 🖥️ UI responsive e moderna
- 📊 Logging dettagliato
- 📸 Screenshot debug automatici

**Happy Booking Automation! 🏨✨**
