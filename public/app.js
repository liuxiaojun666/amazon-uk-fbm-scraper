const form = document.getElementById('scrape-form');
const logPanel = document.getElementById('log-panel');
const jobStatus = document.getElementById('job-status');
const startBtn = document.getElementById('start-btn');
const stopBtns = document.querySelectorAll('.stop-btn');
const summarySection = document.getElementById('summary-section');
const resultsSection = document.getElementById('results-section');
const summaryEl = document.getElementById('summary');
const downloadLinks = document.getElementById('download-links');
const resultsTable = document.getElementById('results-table').querySelector('tbody');
const resultCount = document.getElementById('result-count');
const resultStatus = document.getElementById('result-status');
const resultsEmpty = document.getElementById('results-empty');
const skippedSection = document.getElementById('skipped-section');
const skippedTable = document.getElementById('skipped-table').querySelector('tbody');
const skippedCount = document.getElementById('skipped-count');
const skippedPagination = document.getElementById('skipped-pagination');
const skippedPrev = document.getElementById('skipped-prev');
const skippedNext = document.getElementById('skipped-next');
const skippedPageInfo = document.getElementById('skipped-page-info');

const SKIPPED_PAGE_SIZE = 20;

let currentJobId = null;
let eventSource = null;
let streamedResultCount = 0;
let skippedResults = [];
let skippedPage = 1;

function setStatus(status) {
  jobStatus.textContent = {
    idle: '空闲',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已停止',
  }[status] || status;
  jobStatus.className = `status-badge status-${status}`;
}

function appendLog(message) {
  logPanel.textContent += message + '\n';
  logPanel.scrollTop = logPanel.scrollHeight;
}

function clearResults() {
  logPanel.textContent = '';
  summarySection.hidden = true;
  resultsSection.hidden = true;
  summaryEl.innerHTML = '';
  downloadLinks.innerHTML = '';
  resultsTable.innerHTML = '';
  resultCount.textContent = '';
  resultStatus.hidden = true;
  resultsEmpty.hidden = true;
  resultsEmpty.textContent = '暂无匹配结果，检索进行中…';
  streamedResultCount = 0;
  skippedResults = [];
  skippedPage = 1;
  skippedSection.hidden = true;
  skippedSection.open = false;
  skippedTable.innerHTML = '';
  skippedCount.textContent = '';
  skippedPagination.hidden = true;
}

function showResultsPanel(running = false) {
  resultsSection.hidden = false;
  resultStatus.hidden = !running;
  resultsEmpty.hidden = !running || streamedResultCount > 0;
  updateResultCount(running);
}

function updateResultCount(running = false) {
  const n = streamedResultCount;
  if (n === 0 && running) {
    resultCount.textContent = '';
  } else {
    resultCount.textContent = `(${n} 条${running ? '，持续更新' : ''})`;
  }
}

function formatSkipReason(reason) {
  if (!reason) return '-';
  const excluded = reason.match(/^excluded province \((.+)\)$/);
  if (excluded) return `排除省份（${excluded[1]}）`;
  if (reason === 'no province match') return '未识别省份';
  if (reason === 'not in target provinces') return '非目标省份';
  const noOffers = reason.match(/^no (.+) offers$/);
  if (noOffers) return `无 ${noOffers[1]} Offer`;
  const priceBelow = reason.match(/^price below min \(£(.+)\)$/);
  if (priceBelow) return `价格低于最低价（£${priceBelow[1]}）`;
  const priceAbove = reason.match(/^price above max \(£(.+)\)$/);
  if (priceAbove) return `价格高于最高价（£${priceAbove[1]}）`;
  const deliveryMaxBelow = reason.match(/^delivery max below threshold \(< (\d+) days\)$/);
  if (deliveryMaxBelow) return `最长配送不足（< ${deliveryMaxBelow[1]} 天）`;
  const deliveryMinAbove = reason.match(/^delivery min above threshold \(> (\d+) days\)$/);
  if (deliveryMinAbove) return `最短配送过久（> ${deliveryMinAbove[1]} 天）`;
  if (reason.startsWith('offer check failed:')) return `Offer 抓取失败：${reason.slice('offer check failed:'.length).trim()}`;
  if (reason.startsWith('seller profile failed:')) return `卖家信息失败：${reason.slice('seller profile failed:'.length).trim()}`;
  if (reason.startsWith('non-Chinese seller (')) return `非中国卖家：${reason.slice('non-Chinese seller ('.length, -1)}`;
  return reason;
}

function buildResultRow(row, highlight = false, { showSkipReason = false } = {}) {
  const tr = document.createElement('tr');
  if (highlight) tr.classList.add('row-new');
  const deliveryCell = row.delivery || row.deliveryText || '-';
  const deliveryTitle = row.deliveryText || '';
  const skipReasonCell = showSkipReason
    ? `<td class="skip-reason">${esc(formatSkipReason(row.skipReason))}</td>`
    : '';
  tr.innerHTML = `
    <td>${esc(row.keyword)}</td>
    <td>${esc(row.asin)}</td>
    <td class="title-cell">${esc(row.title)}</td>
    <td>${esc(row.price)}</td>
    <td class="delivery-cell"${deliveryTitle ? ` title="${esc(deliveryTitle)}"` : ''}>${esc(deliveryCell)}</td>
    <td>${esc(row.fulfillment)}</td>
    <td>${esc(row.sellerName)}</td>
    <td class="${row.matchedProvince ? 'province-match' : ''}">${esc(row.matchedProvince || '-')}</td>
    <td class="address-cell">${esc(row.businessAddress)}</td>
    ${skipReasonCell}
    <td>
      <a href="${esc(row.productUrl)}" target="_blank" rel="noopener">商品</a>${row.sellerUrl ? ` · <a href="${esc(row.sellerUrl)}" target="_blank" rel="noopener">卖家</a>` : ''}
    </td>
  `;
  return tr;
}

function updateSkippedCount() {
  const n = skippedResults.length;
  skippedCount.textContent = n > 0 ? `(${n} 条)` : '';
  skippedSection.hidden = n === 0;
}

function renderSkippedPage() {
  const total = skippedResults.length;
  const totalPages = Math.max(1, Math.ceil(total / SKIPPED_PAGE_SIZE));
  skippedPage = Math.min(Math.max(1, skippedPage), totalPages);

  skippedTable.innerHTML = '';
  const start = (skippedPage - 1) * SKIPPED_PAGE_SIZE;
  const pageRows = skippedResults.slice(start, start + SKIPPED_PAGE_SIZE);
  for (const row of pageRows) {
    skippedTable.appendChild(buildResultRow(row, false, { showSkipReason: true }));
  }

  if (total > SKIPPED_PAGE_SIZE) {
    skippedPagination.hidden = false;
    skippedPageInfo.textContent = `第 ${skippedPage} / ${totalPages} 页`;
    skippedPrev.disabled = skippedPage <= 1;
    skippedNext.disabled = skippedPage >= totalPages;
  } else {
    skippedPagination.hidden = true;
  }

  updateSkippedCount();
}

function appendSkipped(row) {
  skippedResults.push(row);
  const totalPages = Math.ceil(skippedResults.length / SKIPPED_PAGE_SIZE);
  if (skippedSection.open || skippedResults.length <= SKIPPED_PAGE_SIZE) {
    skippedPage = totalPages;
    renderSkippedPage();
  } else {
    updateSkippedCount();
  }
}

function renderSkippedResults(rows, { rebuild = true } = {}) {
  if (rebuild) {
    skippedResults = [...rows];
    skippedPage = 1;
  }
  renderSkippedPage();
}

function appendResult(row, { highlight = true } = {}) {
  resultsTable.appendChild(buildResultRow(row, highlight));
  streamedResultCount++;
  resultsEmpty.hidden = true;
  updateResultCount(!resultStatus.hidden);
}

function updateProvinceModeUi() {
  const mode = document.getElementById('provinceMode').value;
  document.getElementById('exclude-provinces-wrap').hidden = mode !== 'exclude';
}

function getFormData() {
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());

  data.provinceMode = document.getElementById('provinceMode').value;
  data.excludeProvinces = document.getElementById('excludeProvinces').value.trim();
  data.allFbm = data.provinceMode === 'all';

  for (const id of ['noPostcode', 'headed', 'skipProxyCheck']) {
    data[id] = document.getElementById(id).checked;
  }

  return data;
}

function setRunning(running) {
  startBtn.disabled = running;
  for (const btn of stopBtns) {
    btn.hidden = !running;
    btn.disabled = false;
    btn.textContent = '停止';
  }
}

function normalizeStats(raw = {}) {
  const searchFiltered = raw.searchFiltered ?? 0;
  const preScanSkipped = raw.preScanSkipped ?? 0;
  const productsScanned = raw.productsScanned ?? 0;
  const searchResultsSeen =
    raw.searchResultsSeen ?? Math.max(0, searchFiltered + preScanSkipped + productsScanned);
  const searchPassed = Math.max(0, searchResultsSeen - searchFiltered);
  const notProcessed = Math.max(0, searchPassed - preScanSkipped - productsScanned);
  const productScanSkipped = raw.productScanSkipped ?? 0;
  const offersFound = raw.offersFound ?? 0;
  const sellersChecked =
    raw.sellersChecked ?? Math.max(0, (raw.provinceMatches ?? 0) + (raw.sellerSkipped ?? 0));
  const provinceMatches = raw.provinceMatches ?? 0;
  const sellerSkipped = raw.sellerSkipped ?? 0;
  const skippedCount = raw.skippedCount ?? raw.provinceSkips ?? 0;
  const errors = raw.errors?.length ?? 0;

  return {
    searchResultsSeen,
    searchFiltered,
    searchPassed,
    preScanSkipped,
    productsScanned,
    notProcessed,
    productScanSkipped,
    offersFound,
    sellersChecked,
    provinceMatches,
    sellerSkipped,
    skippedCount,
    errors,
  };
}

function summaryItem(value, label, { primary = false } = {}) {
  const cls = primary ? 'summary-item summary-item-primary' : 'summary-item';
  return `<div class="${cls}"><div class="value">${value}</div><div class="label">${label}</div></div>`;
}

function buildProductHint(s) {
  const breakdown = [
    s.preScanSkipped > 0 ? `预筛跳过 ${s.preScanSkipped}` : null,
    `深入扫描 ${s.productsScanned}`,
    s.notProcessed > 0 ? `未处理 ${s.notProcessed}` : null,
  ]
    .filter(Boolean)
    .join(' + ');

  if (s.searchPassed === s.productsScanned && s.preScanSkipped === 0 && s.notProcessed === 0) {
    return `搜索见到 ${s.searchResultsSeen} = 搜索筛掉 ${s.searchFiltered} + 深入扫描 ${s.productsScanned}`;
  }
  return `搜索见到 ${s.searchResultsSeen} = 搜索筛掉 ${s.searchFiltered} + 通过筛选 ${s.searchPassed}；${breakdown}`;
}

function renderSummary(job) {
  const s = normalizeStats(job.stats || {});

  const productHint = buildProductHint(s);

  const sellerHint =
    s.sellersChecked > 0
      ? `检查卖家 ${s.sellersChecked} = 省份命中 ${s.provinceMatches} + 卖家未入选 ${s.sellerSkipped}`
      : s.offersFound > 0
        ? `发现 ${s.offersFound} 个 Offer，尚未检查卖家`
        : '扫描商品后未发现符合条件的 Offer';

  const scanSkippedLine =
    s.productScanSkipped > 0
      ? summaryItem(s.productScanSkipped, '扫描筛掉')
      : '';

  const preScanLine =
    s.preScanSkipped > 0
      ? summaryItem(s.preScanSkipped, '预筛跳过')
      : '';

  summaryEl.innerHTML = `
    <div class="summary-group">
      <h3 class="summary-group-title">商品（唯一 ASIN）</h3>
      <div class="summary">
        ${summaryItem(s.searchResultsSeen, '搜索见到', { primary: true })}
        ${summaryItem(s.searchFiltered, '搜索筛掉')}
        ${preScanLine}
        ${summaryItem(s.productsScanned, '深入扫描')}
        ${scanSkippedLine}
      </div>
      <p class="summary-hint">${productHint}</p>
    </div>
    <div class="summary-group">
      <h3 class="summary-group-title">卖家 / Offer</h3>
      <div class="summary">
        ${summaryItem(s.offersFound, '发现 Offer')}
        ${summaryItem(s.sellersChecked, '检查卖家')}
        ${summaryItem(s.provinceMatches, '省份命中', { primary: true })}
        ${summaryItem(s.sellerSkipped, '卖家未入选')}
      </div>
      <p class="summary-hint">${sellerHint}</p>
    </div>
    <div class="summary-group summary-group-compact">
      <div class="summary">
        ${summaryItem(s.skippedCount, '未入选记录')}
        ${summaryItem(s.errors, '错误')}
      </div>
      <p class="summary-hint">未入选记录 = 搜索筛掉 ${s.searchFiltered} + 预筛跳过 ${s.preScanSkipped} + 扫描筛掉 ${s.productScanSkipped} + 卖家未入选 ${s.sellerSkipped}</p>
    </div>
  `;

  downloadLinks.innerHTML = '';
  if (job.jsonPath) {
    const jsonLink = document.createElement('a');
    jsonLink.href = `/api/jobs/${job.id}/download/json`;
    jsonLink.textContent = '下载 JSON';
    downloadLinks.appendChild(jsonLink);
  }
  if (job.csvPath) {
    const csvLink = document.createElement('a');
    csvLink.href = `/api/jobs/${job.id}/download/csv`;
    csvLink.textContent = '下载 CSV';
    downloadLinks.appendChild(csvLink);
  }

  summarySection.hidden = false;
}

function renderResults(results, { running = false, rebuild = true } = {}) {
  if (rebuild) {
    resultsTable.innerHTML = '';
    streamedResultCount = 0;
    for (const row of results) {
      resultsTable.appendChild(buildResultRow(row, false));
      streamedResultCount++;
    }
  }
  resultsEmpty.hidden = streamedResultCount > 0 || !running;
  updateResultCount(running);
  showResultsPanel(running);
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function connectStream(jobId) {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource(`/api/jobs/${jobId}/stream`);

  eventSource.onmessage = (e) => {
    const event = JSON.parse(e.data);

    if (event.type === 'log') {
      appendLog(event.message);
    } else if (event.type === 'result') {
      appendResult(event.result, { highlight: !event.replay });
    } else if (event.type === 'skip') {
      appendSkipped(event.result);
    } else if (event.type === 'done') {
      finishJob(event.job);
    } else if (event.type === 'error') {
      if (event.message) appendLog(`[error] ${event.message}`);
      finishJob(event.job);
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
    eventSource = null;
  };
}

async function finishJob(job) {
  setRunning(false);
  setStatus(job.status);

  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  if (!job.results) {
    try {
      const res = await fetch(`/api/jobs/${job.id}`);
      const data = await res.json();
      job = data.job;
    } catch {
      return;
    }
  }

  renderSummary(job);
  resultStatus.hidden = true;
  const results = job.results || [];
  const skipped = job.skippedResults || [];
  if (streamedResultCount !== results.length) {
    renderResults(results, { running: false, rebuild: true });
  } else {
    updateResultCount(false);
  }
  if (skippedResults.length !== skipped.length) {
    renderSkippedResults(skipped, { rebuild: true });
  }
  if (streamedResultCount === 0) {
    resultsEmpty.hidden = false;
    resultsEmpty.textContent = '无匹配结果';
  } else {
    resultsEmpty.hidden = true;
  }
}

async function startJob(formData) {
  clearResults();
  setStatus('running');
  setRunning(true);
  showResultsPanel(true);
  resultsEmpty.hidden = false;

  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await res.json();

    if (!res.ok) {
      appendLog(`[error] ${data.error}`);
      setStatus('idle');
      setRunning(false);
      return;
    }

    currentJobId = data.job.id;
    connectStream(currentJobId);
  } catch (err) {
    appendLog(`[error] ${err.message}`);
    setStatus('idle');
    setRunning(false);
  }
}

async function stopJob() {
  if (!currentJobId) return;

  for (const btn of stopBtns) {
    btn.disabled = true;
    btn.textContent = '停止中…';
  }

  try {
    await fetch(`/api/jobs/${currentJobId}/cancel`, { method: 'POST' });
  } catch (err) {
    appendLog(`[error] 停止失败: ${err.message}`);
    setRunning(true);
  }
}

document.getElementById('provinceMode').addEventListener('change', updateProvinceModeUi);
updateProvinceModeUi();

form.addEventListener('submit', (e) => {
  e.preventDefault();
  startJob(getFormData());
});

for (const btn of stopBtns) {
  btn.addEventListener('click', stopJob);
}

skippedPrev.addEventListener('click', () => {
  if (skippedPage > 1) {
    skippedPage--;
    renderSkippedPage();
  }
});

skippedNext.addEventListener('click', () => {
  const totalPages = Math.ceil(skippedResults.length / SKIPPED_PAGE_SIZE);
  if (skippedPage < totalPages) {
    skippedPage++;
    renderSkippedPage();
  }
});

skippedSection.addEventListener('toggle', () => {
  if (skippedSection.open) {
    renderSkippedPage();
  }
});

async function init() {
  try {
    const res = await fetch('/api/jobs/current');
    const data = await res.json();
    if (data.job?.status === 'running') {
      currentJobId = data.job.id;
      setStatus('running');
      setRunning(true);
      showResultsPanel(true);
      if ((data.job.results || []).length === 0) {
        resultsEmpty.hidden = false;
      }
      connectStream(currentJobId);
    } else if (data.job) {
      setStatus(data.job.status);
      currentJobId = data.job.id;
      if (data.job.status === 'completed') {
        renderSummary(data.job);
        renderResults(data.job.results || []);
        renderSkippedResults(data.job.skippedResults || []);
      }
    }
  } catch {
    // server not ready
  }
}

init();
