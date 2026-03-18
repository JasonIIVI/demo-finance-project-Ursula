# demo-finance-project-Ursula

A live-data finance dashboard focused on company stocks, bonds/yields, futures, financial news, and X monitoring.

## What changed

This project is now structured as a small Node server that serves the dashboard UI and exposes a `/api/dashboard` endpoint that aggregates multiple live providers.

### Live providers supported

- **Stocks:** Finnhub or Alpha Vantage.
- **Bonds / yields:** FRED.
- **Futures:** Financial Modeling Prep.
- **Financial news:** NewsAPI.
- **X / Twitter tracking:** X recent-search API.

If a provider key is missing, the dashboard still runs and clearly labels that panel as fallback/demo data so you can wire providers incrementally.

## Run locally

### 1. Create your environment file

Copy the template:

```bash
cp .env.example .env
```

Then add your real API keys.

### 2. Start the dashboard

```bash
npm start
```

Then open:

```text
http://localhost:8000
```

## Environment variables

```bash
PORT=8000
FINNHUB_API_KEY=
ALPHA_VANTAGE_API_KEY=
FRED_API_KEY=
FMP_API_KEY=
NEWS_API_KEY=
X_BEARER_TOKEN=
STOCK_SYMBOLS=MSFT,NVDA,JPM,XOM,BA,GS
FUTURES_SYMBOLS=ESUSD,NQUSD,CLUSD,GCUSD
NEWS_QUERY=(stocks OR bonds OR futures) AND (earnings OR yields OR treasury OR crude)
X_QUERY=(stocks OR bonds OR futures) lang:en -is:retweet
```

## Notes

- This repo does **not** include API keys.
- Some providers have rate limits on free tiers.
- The dashboard refreshes every 60 seconds in the browser.
- The server uses built-in Node APIs only, so there is no `npm install` step required.
