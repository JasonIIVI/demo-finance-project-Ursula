const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

loadEnv(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT || 8000);
const ROOT = __dirname;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const STOCK_SYMBOLS = splitList(process.env.STOCK_SYMBOLS, ['MSFT', 'NVDA', 'JPM', 'XOM', 'BA', 'GS']);
const FUTURES_SYMBOLS = splitList(process.env.FUTURES_SYMBOLS, ['ESUSD', 'NQUSD', 'CLUSD', 'GCUSD']);
const NEWS_QUERY = process.env.NEWS_QUERY || '(stocks OR bonds OR futures) AND (earnings OR yields OR treasury OR crude)';
const X_QUERY = process.env.X_QUERY || '(stocks OR bonds OR futures) lang:en -is:retweet';

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === '/api/dashboard') {
    return handleDashboard(res);
  }

  if (requestUrl.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, timestamp: new Date().toISOString() });
  }

  return serveStatic(requestUrl.pathname, res);
});

server.listen(PORT, () => {
  console.log(`Terminal Finance dashboard available at http://localhost:${PORT}`);
});

async function handleDashboard(res) {
  try {
    const [stocks, bonds, futures, news, social] = await Promise.all([
      getStocks(),
      getBonds(),
      getFutures(),
      getNews(),
      getSocialPosts(),
    ]);

    const payload = {
      meta: {
        generatedAt: new Date().toISOString(),
        coverage: ['stocks', 'bonds', 'futures'],
        excluded: ['forex', 'crypto'],
      },
      providers: {
        stocks: stocks.provider,
        bonds: bonds.provider,
        futures: futures.provider,
        news: news.provider,
        social: social.provider,
      },
      stocks: stocks.items,
      bonds: bonds.items,
      futures: futures.items,
      news: news.items,
      social: social.items,
      alerts: buildAlerts({ stocks: stocks.items, bonds: bonds.items, futures: futures.items, news: news.items, social: social.items }),
      errors: [stocks.error, bonds.error, futures.error, news.error, social.error].filter(Boolean),
    };

    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 500, {
      error: 'dashboard_fetch_failed',
      message: error.message,
      generatedAt: new Date().toISOString(),
    });
  }
}

async function getStocks() {
  if (process.env.FINNHUB_API_KEY) {
    try {
      const items = await Promise.all(
        STOCK_SYMBOLS.map(async (symbol) => {
          const quote = await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${process.env.FINNHUB_API_KEY}`);
          return {
            ticker: symbol,
            company: symbol,
            price: Number(quote.c || 0),
            changePercent: Number(quote.dp || 0),
            changeValue: Number(quote.d || 0),
            high: Number(quote.h || 0),
            low: Number(quote.l || 0),
            previousClose: Number(quote.pc || 0),
            source: 'Finnhub',
          };
        }),
      );
      return { provider: providerStatus('Finnhub', true), items };
    } catch (error) {
      return { provider: providerStatus('Finnhub', false, error.message), items: demoStocks(), error: providerError('stocks', error) };
    }
  }

  if (process.env.ALPHA_VANTAGE_API_KEY) {
    try {
      const items = await Promise.all(
        STOCK_SYMBOLS.map(async (symbol) => {
          const quote = await fetchJson(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`);
          const item = quote['Global Quote'] || {};
          return {
            ticker: symbol,
            company: symbol,
            price: Number(item['05. price'] || 0),
            changePercent: Number(String(item['10. change percent'] || '0').replace('%', '')),
            changeValue: Number(item['09. change'] || 0),
            high: Number(item['03. high'] || 0),
            low: Number(item['04. low'] || 0),
            previousClose: Number(item['08. previous close'] || 0),
            source: 'Alpha Vantage',
          };
        }),
      );
      return { provider: providerStatus('Alpha Vantage', true), items };
    } catch (error) {
      return { provider: providerStatus('Alpha Vantage', false, error.message), items: demoStocks(), error: providerError('stocks', error) };
    }
  }

  return { provider: providerStatus('Stock API not configured', false, 'Add FINNHUB_API_KEY or ALPHA_VANTAGE_API_KEY'), items: demoStocks() };
}

async function getBonds() {
  const seriesMap = [
    { id: 'DGS2', name: 'US 2Y Treasury', unit: '%' },
    { id: 'DGS10', name: 'US 10Y Treasury', unit: '%' },
    { id: 'DGS30', name: 'US 30Y Treasury', unit: '%' },
    { id: 'AAA', name: 'Moody\'s Aaa Corporate', unit: '%' },
  ];

  if (!process.env.FRED_API_KEY) {
    return { provider: providerStatus('FRED not configured', false, 'Add FRED_API_KEY'), items: demoBonds() };
  }

  try {
    const items = await Promise.all(
      seriesMap.map(async (series) => {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series.id}&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=2`;
        const response = await fetchJson(url);
        const observations = Array.isArray(response.observations) ? response.observations.filter((row) => row.value !== '.') : [];
        const latest = observations[0];
        const prior = observations[1];
        const value = Number(latest?.value || 0);
        const previous = Number(prior?.value || 0);
        return {
          name: series.name,
          seriesId: series.id,
          value,
          change: Number((value - previous).toFixed(3)),
          asOf: latest?.date || null,
          unit: series.unit,
          source: 'FRED',
        };
      }),
    );

    return { provider: providerStatus('FRED', true), items };
  } catch (error) {
    return { provider: providerStatus('FRED', false, error.message), items: demoBonds(), error: providerError('bonds', error) };
  }
}

async function getFutures() {
  if (!process.env.FMP_API_KEY) {
    return { provider: providerStatus('Financial Modeling Prep not configured', false, 'Add FMP_API_KEY'), items: demoFutures() };
  }

  try {
    const symbols = FUTURES_SYMBOLS.join(',');
    const response = await fetchJson(`https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(symbols)}?apikey=${process.env.FMP_API_KEY}`);
    const items = Array.isArray(response)
      ? response.map((item) => ({
          symbol: item.symbol,
          name: item.name || item.symbol,
          price: Number(item.price || 0),
          changePercent: Number(item.changesPercentage || 0),
          changeValue: Number(item.change || 0),
          dayLow: Number(item.dayLow || 0),
          dayHigh: Number(item.dayHigh || 0),
          source: 'Financial Modeling Prep',
        }))
      : [];

    return { provider: providerStatus('Financial Modeling Prep', true), items: items.length ? items : demoFutures() };
  } catch (error) {
    return { provider: providerStatus('Financial Modeling Prep', false, error.message), items: demoFutures(), error: providerError('futures', error) };
  }
}

async function getNews() {
  if (!process.env.NEWS_API_KEY) {
    return { provider: providerStatus('NewsAPI not configured', false, 'Add NEWS_API_KEY'), items: demoNews() };
  }

  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(NEWS_QUERY)}&language=en&pageSize=8&sortBy=publishedAt`;
    const response = await fetchJson(url, { headers: { 'X-Api-Key': process.env.NEWS_API_KEY } });
    const items = Array.isArray(response.articles)
      ? response.articles.map((article) => ({
          source: article.source?.name || 'NewsAPI',
          headline: article.title,
          summary: article.description,
          url: article.url,
          publishedAt: article.publishedAt,
        }))
      : [];
    return { provider: providerStatus('NewsAPI', true), items: items.length ? items : demoNews() };
  } catch (error) {
    return { provider: providerStatus('NewsAPI', false, error.message), items: demoNews(), error: providerError('news', error) };
  }
}

async function getSocialPosts() {
  if (!process.env.X_BEARER_TOKEN) {
    return { provider: providerStatus('X API not configured', false, 'Add X_BEARER_TOKEN'), items: demoSocial() };
  }

  try {
    const url = `https://api.x.com/2/tweets/search/recent?max_results=10&tweet.fields=created_at,public_metrics&expansions=author_id&user.fields=name,username&query=${encodeURIComponent(X_QUERY)}`;
    const response = await fetchJson(url, { headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` } });
    const users = new Map((response.includes?.users || []).map((user) => [user.id, user]));
    const items = Array.isArray(response.data)
      ? response.data.map((tweet) => ({
          id: tweet.id,
          handle: users.get(tweet.author_id)?.username ? `@${users.get(tweet.author_id).username}` : '@unknown',
          author: users.get(tweet.author_id)?.name || 'Unknown',
          text: tweet.text,
          createdAt: tweet.created_at,
          metrics: tweet.public_metrics || {},
          url: `https://x.com/i/web/status/${tweet.id}`,
        }))
      : [];
    return { provider: providerStatus('X API', true), items: items.length ? items : demoSocial() };
  } catch (error) {
    return { provider: providerStatus('X API', false, error.message), items: demoSocial(), error: providerError('social', error) };
  }
}

function buildAlerts({ stocks, bonds, futures, news, social }) {
  const alerts = [];
  const hottestStock = [...stocks].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))[0];
  if (hottestStock) {
    alerts.push({
      title: `${hottestStock.ticker} volatility`,
      summary: `${hottestStock.ticker} is moving ${formatSigned(hottestStock.changePercent, '%')} with live quote coverage.`,
      market: 'Stocks',
      priority: Math.abs(hottestStock.changePercent) >= 2 ? 'Critical' : 'High',
    });
  }

  const tenYear = bonds.find((bond) => bond.seriesId === 'DGS10' || bond.name.includes('10Y'));
  if (tenYear) {
    alerts.push({
      title: '10Y yield monitor',
      summary: `US 10Y Treasury at ${formatNumber(tenYear.value, 2)}${tenYear.unit} (${formatSigned(tenYear.change, tenYear.unit === '%' ? ' pts' : '')}).`,
      market: 'Bonds',
      priority: Math.abs(tenYear.change) >= 0.05 ? 'Critical' : 'Medium',
    });
  }

  const crude = futures.find((future) => future.symbol?.includes('CL') || future.name?.toLowerCase().includes('crude'));
  if (crude) {
    alerts.push({
      title: 'Energy futures pulse',
      summary: `${crude.name} is ${formatSigned(crude.changePercent, '%')} at ${formatCurrency(crude.price)}.`,
      market: 'Futures',
      priority: Math.abs(crude.changePercent) >= 1 ? 'High' : 'Medium',
    });
  }

  if (news[0]) {
    alerts.push({
      title: 'Latest headline',
      summary: news[0].headline,
      market: 'News',
      priority: 'High',
    });
  }

  if (social[0]) {
    alerts.push({
      title: 'X signal spike',
      summary: `${social[0].handle}: ${truncate(social[0].text || social[0].headline || '', 120)}`,
      market: 'X',
      priority: 'Medium',
    });
  }

  return alerts;
}

function serveStatic(requestPath, res) {
  const safePath = requestPath === '/' ? '/index.html' : requestPath;
  const resolved = path.normalize(path.join(ROOT, safePath));
  if (!resolved.startsWith(ROOT)) {
    return sendJson(res, 403, { error: 'forbidden' });
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'not_found' });
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 200)}`);
  }
  return response.json();
}

function providerStatus(name, connected, detail = '') {
  return { name, connected, detail };
}

function providerError(area, error) {
  return { area, message: error.message };
}

function splitList(value, fallback) {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : fallback;
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function formatSigned(value, suffix = '') {
  const numeric = Number(value || 0);
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}${suffix}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value || 0));
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function demoStocks() {
  return [
    { ticker: 'MSFT', company: 'Microsoft', price: 428.16, changePercent: 1.84, changeValue: 7.74, high: 430.02, low: 421.11, previousClose: 420.42, source: 'Demo fallback' },
    { ticker: 'NVDA', company: 'NVIDIA', price: 911.42, changePercent: 2.61, changeValue: 23.19, high: 919.81, low: 889.73, previousClose: 888.23, source: 'Demo fallback' },
    { ticker: 'JPM', company: 'JPMorgan Chase', price: 198.74, changePercent: -0.28, changeValue: -0.56, high: 200.31, low: 197.62, previousClose: 199.3, source: 'Demo fallback' },
  ];
}

function demoBonds() {
  return [
    { name: 'US 2Y Treasury', seriesId: 'DGS2', value: 4.61, change: 0.021, asOf: 'Demo', unit: '%', source: 'Demo fallback' },
    { name: 'US 10Y Treasury', seriesId: 'DGS10', value: 4.18, change: 0.034, asOf: 'Demo', unit: '%', source: 'Demo fallback' },
    { name: 'US 30Y Treasury', seriesId: 'DGS30', value: 4.34, change: 0.018, asOf: 'Demo', unit: '%', source: 'Demo fallback' },
    { name: 'Moody\'s Aaa Corporate', seriesId: 'AAA', value: 5.12, change: -0.01, asOf: 'Demo', unit: '%', source: 'Demo fallback' },
  ];
}

function demoFutures() {
  return [
    { symbol: 'ESUSD', name: 'S&P 500 Futures', price: 5248.25, changePercent: 0.62, changeValue: 32.25, dayLow: 5201.5, dayHigh: 5253.25, source: 'Demo fallback' },
    { symbol: 'NQUSD', name: 'Nasdaq 100 Futures', price: 18271.75, changePercent: 0.96, changeValue: 173.5, dayLow: 18110, dayHigh: 18309, source: 'Demo fallback' },
    { symbol: 'CLUSD', name: 'WTI Crude Futures', price: 81.44, changePercent: 0.71, changeValue: 0.57, dayLow: 80.61, dayHigh: 81.88, source: 'Demo fallback' },
  ];
}

function demoNews() {
  return [
    { source: 'Demo wire', headline: 'Configure NEWS_API_KEY to replace this placeholder with live financial headlines.', summary: 'The live mode supports real article timestamps, sources, and links for equities, bonds, and futures coverage.', url: '#', publishedAt: new Date().toISOString() },
  ];
}

function demoSocial() {
  return [
    { id: 'demo', handle: '@terminalfinance', author: 'Terminal Finance', text: 'Add X_BEARER_TOKEN to stream recent market conversation into the dashboard.', createdAt: new Date().toISOString(), metrics: { like_count: 0, retweet_count: 0, reply_count: 0, quote_count: 0 }, url: '#' },
  ];
}
