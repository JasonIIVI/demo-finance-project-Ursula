const state = {
  payload: null,
  selectedAlerts: new Set(),
};

const elements = {
  providerGrid: document.getElementById('providerGrid'),
  lastUpdated: document.getElementById('lastUpdated'),
  statusBanner: document.getElementById('statusBanner'),
  heroStats: document.getElementById('heroStats'),
  stockTable: document.getElementById('stockTable'),
  bondGrid: document.getElementById('bondGrid'),
  futuresGrid: document.getElementById('futuresGrid'),
  newsFeed: document.getElementById('newsFeed'),
  socialFeed: document.getElementById('socialFeed'),
  alertList: document.getElementById('alertList'),
  refreshButton: document.getElementById('refreshButton'),
};

async function loadDashboard() {
  setStatus('loading', 'Loading live market stack…');

  try {
    const response = await fetch('/api/dashboard');
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || payload.error || 'Unable to load dashboard');
    }

    state.payload = payload;
    if (!state.selectedAlerts.size) {
      payload.alerts.slice(0, 3).forEach((alert) => state.selectedAlerts.add(alert.title));
    }
    render(payload);

    const liveProviders = Object.values(payload.providers).filter((provider) => provider.connected).length;
    const totalProviders = Object.values(payload.providers).length;
    const statusMode = liveProviders === totalProviders ? 'live' : 'warning';
    setStatus(statusMode, `${liveProviders}/${totalProviders} providers connected. ${payload.errors.length ? 'Some panels are using labeled fallback data.' : 'All configured feeds are live.'}`);
  } catch (error) {
    setStatus('warning', `Dashboard failed to refresh: ${error.message}`);
  }
}

function render(payload) {
  elements.lastUpdated.textContent = `Updated ${new Date(payload.meta.generatedAt).toLocaleString()}`;
  renderProviders(payload.providers);
  renderHero(payload);
  renderStocks(payload.stocks);
  renderBonds(payload.bonds);
  renderFutures(payload.futures);
  renderNews(payload.news);
  renderSocial(payload.social);
  renderAlerts(payload.alerts);
}

function renderProviders(providers) {
  elements.providerGrid.innerHTML = Object.entries(providers)
    .map(([key, provider]) => `
      <article class="provider-card ${provider.connected ? 'connected' : 'disconnected'}">
        <div class="card-topline">
          <strong>${titleize(key)}</strong>
          <span class="label-tag">${provider.connected ? 'LIVE' : 'SETUP NEEDED'}</span>
        </div>
        <p>${provider.name}</p>
        <p class="muted small">${provider.detail || (provider.connected ? 'Streaming market data into the dashboard.' : 'No provider detail available.')}</p>
      </article>
    `)
    .join('');
}

function renderHero(payload) {
  const tenYear = payload.bonds.find((bond) => bond.seriesId === 'DGS10') || payload.bonds[0];
  const topStock = [...payload.stocks].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))[0];
  const topFuture = [...payload.futures].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))[0];

  const stats = [
    {
      label: 'Lead stock',
      value: topStock ? `${topStock.ticker} ${formatSigned(topStock.changePercent, '%')}` : 'N/A',
      detail: topStock ? `${formatCurrency(topStock.price)} • ${topStock.source}` : 'No stock data',
      tone: topStock?.changePercent >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'US 10Y',
      value: tenYear ? `${formatNumber(tenYear.value, 2)}${tenYear.unit}` : 'N/A',
      detail: tenYear ? `${formatSigned(tenYear.change, ' pts')} • ${tenYear.source}` : 'No yield data',
      tone: tenYear?.change >= 0 ? 'negative' : 'positive',
    },
    {
      label: 'Lead future',
      value: topFuture ? `${topFuture.symbol} ${formatSigned(topFuture.changePercent, '%')}` : 'N/A',
      detail: topFuture ? `${formatCurrency(topFuture.price)} • ${topFuture.source}` : 'No futures data',
      tone: topFuture?.changePercent >= 0 ? 'positive' : 'negative',
    },
  ];

  elements.heroStats.innerHTML = stats
    .map((stat) => `
      <article class="stat-card">
        <p class="section-label">${stat.label}</p>
        <div class="value ${stat.tone}">${stat.value}</div>
        <p class="muted small">${stat.detail}</p>
      </article>
    `)
    .join('');
}

function renderStocks(stocks) {
  elements.stockTable.innerHTML = stocks
    .map((stock) => `
      <tr>
        <td class="mono">${stock.ticker}</td>
        <td>${formatCurrency(stock.price)}</td>
        <td class="${stock.changePercent >= 0 ? 'positive' : 'negative'}">${formatSigned(stock.changePercent, '%')}</td>
        <td>${formatCurrency(stock.low)} - ${formatCurrency(stock.high)}</td>
        <td>${stock.source}</td>
      </tr>
    `)
    .join('');
}

function renderBonds(bonds) {
  elements.bondGrid.innerHTML = bonds
    .map((bond) => `
      <article class="bond-card">
        <div class="card-topline">
          <strong>${bond.name}</strong>
          <span class="label-tag">${bond.asOf || 'Latest'}</span>
        </div>
        <div class="value ${bond.change <= 0 ? 'positive' : 'negative'}">${formatNumber(bond.value, 2)}${bond.unit}</div>
        <p class="muted small">${formatSigned(bond.change, ' pts')} • ${bond.source}</p>
      </article>
    `)
    .join('');
}

function renderFutures(futures) {
  elements.futuresGrid.innerHTML = futures
    .map((future) => `
      <article class="future-card">
        <div class="card-topline">
          <div>
            <strong>${future.name}</strong>
            <p class="muted small">${future.symbol}</p>
          </div>
          <span class="label-tag ${future.changePercent >= 0 ? 'positive' : 'negative'}">${formatSigned(future.changePercent, '%')}</span>
        </div>
        <div class="value">${formatCurrency(future.price)}</div>
        <p class="muted small">${formatCurrency(future.dayLow)} - ${formatCurrency(future.dayHigh)} • ${future.source}</p>
      </article>
    `)
    .join('');
}

function renderNews(news) {
  elements.newsFeed.innerHTML = news
    .map((story) => `
      <article class="story">
        <p class="story-meta">${story.source} • ${formatDate(story.publishedAt)}</p>
        <h4>${story.headline}</h4>
        <p class="muted small">${story.summary || ''}</p>
        <a class="label-tag" href="${story.url}" target="_blank" rel="noreferrer">Open source</a>
      </article>
    `)
    .join('');
}

function renderSocial(social) {
  elements.socialFeed.innerHTML = social
    .map((post) => `
      <article class="social-card">
        <p class="social-meta">${post.handle} • ${formatDate(post.createdAt)}</p>
        <h4>${post.author}</h4>
        <p class="muted small">${post.text}</p>
        <p class="story-meta">Likes ${post.metrics.like_count || 0} • Reposts ${post.metrics.retweet_count || 0}</p>
        <a class="label-tag" href="${post.url}" target="_blank" rel="noreferrer">View on X</a>
      </article>
    `)
    .join('');
}

function renderAlerts(alerts) {
  elements.alertList.innerHTML = alerts
    .map((alert) => `
      <label class="alert-card">
        <div class="card-topline">
          <strong>${alert.title}</strong>
          <span class="label-tag">${alert.priority}</span>
        </div>
        <p class="muted small">${alert.summary}</p>
        <p class="story-meta">${alert.market}</p>
      </label>
    `)
    .join('');
}

function setStatus(mode, text) {
  elements.statusBanner.className = `status-banner ${mode}`;
  elements.statusBanner.textContent = text;
}

function titleize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(Number(value || 0));
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value || 0));
}

function formatSigned(value, suffix = '') {
  const numeric = Number(value || 0);
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}${suffix}`;
}

function formatDate(value) {
  if (!value) return 'Latest';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

elements.refreshButton.addEventListener('click', loadDashboard);
loadDashboard();
setInterval(loadDashboard, 60000);
