const dashboardData = {
  heroStats: [
    { label: 'S&P 500 Futures', value: '+0.62%', tone: 'positive', detail: 'Risk sentiment firming into open' },
    { label: 'US 10Y Yield', value: '4.18%', tone: 'negative', detail: '+3.4 bps after auction chatter' },
    { label: 'Breaking Alerts', value: '06', tone: 'neutral', detail: '3 selected by you' },
  ],
  stocks: [
    { ticker: 'MSFT', company: 'Microsoft', price: '$428.16', change: '+1.84%', volume: '18.3M', signal: 'AI capex momentum', tone: 'bullish' },
    { ticker: 'NVDA', company: 'NVIDIA', price: '$911.42', change: '+2.61%', volume: '42.8M', signal: 'Semis leadership', tone: 'bullish' },
    { ticker: 'JPM', company: 'JPMorgan Chase', price: '$198.74', change: '-0.28%', volume: '9.1M', signal: 'Yield sensitivity', tone: 'neutral' },
    { ticker: 'XOM', company: 'Exxon Mobil', price: '$116.07', change: '+0.49%', volume: '14.6M', signal: 'Crude-linked upside', tone: 'bullish' },
    { ticker: 'BA', company: 'Boeing', price: '$187.11', change: '-1.33%', volume: '11.9M', signal: 'Headline risk', tone: 'bearish' },
    { ticker: 'GS', company: 'Goldman Sachs', price: '$389.08', change: '+0.22%', volume: '2.8M', signal: 'Deal pipeline', tone: 'neutral' },
  ],
  bonds: [
    { name: 'US 2Y Treasury', yield: '4.61%', change: '+2.1 bps', note: 'Front-end pricing stays hawkish', tone: 'negative' },
    { name: 'US 10Y Treasury', yield: '4.18%', change: '+3.4 bps', note: 'Auction focus and fiscal supply', tone: 'negative' },
    { name: 'US 30Y Treasury', yield: '4.34%', change: '+1.8 bps', note: 'Long-end stable versus curve', tone: 'neutral' },
    { name: 'IG Corp OAS', yield: '96 bps', change: '-4 bps', note: 'Credit spreads continue tightening', tone: 'positive' },
  ],
  futures: [
    { symbol: 'ESM6', name: 'S&P 500', last: '5,248.25', change: '+0.62%', context: 'Large-cap equities bid' },
    { symbol: 'NQM6', name: 'Nasdaq 100', last: '18,271.75', change: '+0.96%', context: 'Tech leadership intact' },
    { symbol: 'CLM6', name: 'WTI Crude', last: '$81.44', change: '+0.71%', context: 'Energy demand headlines' },
    { symbol: 'ZNM6', name: '10Y Note', last: '109-18', change: '-0.19%', context: 'Higher yield pressure' },
  ],
  news: [
    { source: 'Bloomberg-style wire', time: '08:12 UTC', headline: 'Mega-cap tech and brokers lift equities as treasury supply remains in focus.', detail: 'Desk summary blends sector rotation, rates repricing, and corporate updates most likely to move stock baskets.' },
    { source: 'Reuters-style wire', time: '08:05 UTC', headline: 'Oil futures edge higher, supporting integrated energy names and transport hedging activity.', detail: 'Watch energy producers, airlines, and futures curves for second-order moves through the session.' },
    { source: 'Rates desk note', time: '07:48 UTC', headline: 'Corporate bond spreads tighten even as the Treasury curve cheapens.', detail: 'Favors high-grade issuers and financials if macro headlines do not deteriorate.' },
  ],
  social: [
    { handle: '@marketstructure', time: '2m ago', headline: 'Volume spike in NVDA, MSFT, and broad index futures suggests institutions are positioning before the open.', detail: 'Useful for stocks + futures alerting when paired with tape acceleration.' },
    { handle: '@rateswatch', time: '9m ago', headline: 'Treasury chatter centered on long-end buyers stepping in after yields pushed above the session median.', detail: 'Relevant for bond alerts and rate-sensitive financials.' },
    { handle: '@energyflows', time: '12m ago', headline: 'WTI futures buying renewed after refinery commentary; energy equities responding in sympathy.', detail: 'Pairs futures headlines with X sentiment to spot cross-market follow-through.' },
  ],
  alertOptions: [
    { id: 'earnings', title: 'Earnings surprise alerts', summary: 'Follow pre-market and post-close reports for key stock names.', priority: 'High', market: 'Stocks' },
    { id: 'rates', title: 'Treasury yield shock', summary: 'Notify when 2Y or 10Y yields move sharply and pressure equities.', priority: 'Critical', market: 'Bonds' },
    { id: 'futures', title: 'Futures momentum break', summary: 'Flag large directional moves in equity, crude, and note futures.', priority: 'High', market: 'Futures' },
    { id: 'social', title: 'X sentiment acceleration', summary: 'Highlight unusual posting velocity from selected market accounts.', priority: 'Medium', market: 'News/X' },
  ],
};

const selected = new Set(['rates', 'futures']);

const heroStats = document.getElementById('heroStats');
const stockTable = document.getElementById('stockTable');
const bondGrid = document.getElementById('bondGrid');
const futuresGrid = document.getElementById('futuresGrid');
const newsFeed = document.getElementById('newsFeed');
const socialFeed = document.getElementById('socialFeed');
const alertList = document.getElementById('alertList');
const selectedAlerts = document.getElementById('selectedAlerts');
const clearAlerts = document.getElementById('clearAlerts');

function toneClass(value) {
  if (value === 'positive' || value === 'bullish') return 'positive';
  if (value === 'negative' || value === 'bearish') return 'negative';
  return '';
}

function renderHeroStats() {
  heroStats.innerHTML = dashboardData.heroStats
    .map(
      (stat) => `
        <article class="stat-card">
          <p class="section-label">${stat.label}</p>
          <div class="value ${toneClass(stat.tone)}">${stat.value}</div>
          <p class="muted small">${stat.detail}</p>
        </article>
      `,
    )
    .join('');
}

function renderStocks() {
  stockTable.innerHTML = dashboardData.stocks
    .map(
      (stock) => `
        <tr>
          <td class="mono">${stock.ticker}</td>
          <td>${stock.company}</td>
          <td class="price">${stock.price}</td>
          <td class="price ${toneClass(stock.tone)}">${stock.change}</td>
          <td class="mono">${stock.volume}</td>
          <td><span class="signal ${stock.tone}">${stock.signal}</span></td>
        </tr>
      `,
    )
    .join('');
}

function renderBonds() {
  bondGrid.innerHTML = dashboardData.bonds
    .map(
      (bond) => `
        <article class="bond-card">
          <div class="card-topline">
            <strong>${bond.name}</strong>
            <span class="label-tag">${bond.change}</span>
          </div>
          <div class="value yield ${toneClass(bond.tone)}">${bond.yield}</div>
          <p class="muted small">${bond.note}</p>
        </article>
      `,
    )
    .join('');
}

function renderFutures() {
  futuresGrid.innerHTML = dashboardData.futures
    .map(
      (future) => `
        <article class="future-card">
          <div class="card-topline">
            <div>
              <strong>${future.name}</strong>
              <p class="muted small">${future.symbol}</p>
            </div>
            <span class="label-tag ${future.change.startsWith('-') ? 'negative' : 'positive'}">${future.change}</span>
          </div>
          <div class="value mono">${future.last}</div>
          <p class="muted small">${future.context}</p>
        </article>
      `,
    )
    .join('');
}

function renderStories() {
  newsFeed.innerHTML = dashboardData.news
    .map(
      (story) => `
        <article class="story">
          <p class="story-meta">${story.source} • ${story.time}</p>
          <h4>${story.headline}</h4>
          <p class="muted small">${story.detail}</p>
        </article>
      `,
    )
    .join('');

  socialFeed.innerHTML = dashboardData.social
    .map(
      (story) => `
        <article class="social-card">
          <p class="social-meta">${story.handle} • ${story.time}</p>
          <h4>${story.headline}</h4>
          <p class="muted small">${story.detail}</p>
        </article>
      `,
    )
    .join('');
}

function renderAlertSelector() {
  alertList.innerHTML = dashboardData.alertOptions
    .map(
      (alert) => `
        <label class="alert-option ${selected.has(alert.id) ? 'active' : ''}">
          <input type="checkbox" data-alert-id="${alert.id}" ${selected.has(alert.id) ? 'checked' : ''} />
          <span>
            <strong>${alert.title}</strong>
            <p class="muted small">${alert.summary}</p>
            <span class="label-tag">${alert.market} • ${alert.priority}</span>
          </span>
        </label>
      `,
    )
    .join('');

  alertList.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const id = event.target.dataset.alertId;
      if (event.target.checked) {
        selected.add(id);
      } else {
        selected.delete(id);
      }
      renderAlertSelector();
      renderSelectedAlerts();
    });
  });
}

function renderSelectedAlerts() {
  const activeAlerts = dashboardData.alertOptions.filter((alert) => selected.has(alert.id));

  if (!activeAlerts.length) {
    selectedAlerts.className = 'selected-alerts empty-state';
    selectedAlerts.innerHTML = 'Select alert presets from the left rail to pin them here.';
    return;
  }

  selectedAlerts.className = 'selected-alerts';
  selectedAlerts.innerHTML = activeAlerts
    .map(
      (alert) => `
        <article class="alert-card">
          <div class="card-topline">
            <strong>${alert.title}</strong>
            <span class="label-tag">${alert.priority}</span>
          </div>
          <p class="muted small">${alert.summary}</p>
          <p class="story-meta">Coverage: ${alert.market}</p>
        </article>
      `,
    )
    .join('');
}

clearAlerts.addEventListener('click', () => {
  selected.clear();
  renderAlertSelector();
  renderSelectedAlerts();
});

renderHeroStats();
renderStocks();
renderBonds();
renderFutures();
renderStories();
renderAlertSelector();
renderSelectedAlerts();
