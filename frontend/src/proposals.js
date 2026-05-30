/**
 * VoteChain — Proposals page
 *
 * Renders governance proposals with state badges, vote summaries,
 * countdown timers for active proposals, and paginated navigation.
 *
 * Data source: replace `MOCK_PROPOSALS` with a real Stellar RPC /
 * Horizon call to your deployed governance contract.
 */

'use strict';

// ── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const FILTER_STATES = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'passed', label: 'Passed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'executed', label: 'Executed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const TOAST_DURATION_MS = 5000;
const TOAST_STATUS = {
  pending: 'pending',
  confirmed: 'confirmed',
  failed: 'failed',
};

let currentPage = 1;
let activeFilter = 'all';
let searchQuery = '';
let pageSize = DEFAULT_PAGE_SIZE;
let countdownTimers = [];
let toastTimer = null;
let currentToast = null;

// ── Wallet State (SEC-013) ───────────────────────────────────────────────────

let userAddress = null;

function updateWalletUI() {
  const btn = document.getElementById('wallet-connect-btn');
  if (!btn) return;
  if (userAddress) {
    btn.textContent = `${userAddress.slice(0, 6)}…${userAddress.slice(-4)}`;
    btn.classList.add('connected');
  } else {
    btn.textContent = 'Connect Wallet';
    btn.classList.remove('connected');
  }
}

async function connectWallet() {
  const freighter = window.freighter;
  if (!freighter) {
    alert('Freighter extension not found. Please install the extension to connect.');
    return;
  }
  try {
    await freighter.requestAccess();
    userAddress = await freighter.getPublicKey();
    updateWalletUI();
  } catch (e) {
    console.error('Wallet connection failed:', e);
    alert('Failed to connect wallet.');
  }
}

// ── Mock data ────────────────────────────────────────────────────────────────
// Replace this array with a live fetch from your Stellar RPC endpoint.
// Each object mirrors the on-chain `Proposal` struct.

const now = Math.floor(Date.now() / 1000);

const MOCK_PROPOSALS = [
  {
    id: 1,
    title: 'Increase minimum proposal balance to 500,000 tokens',
    proposer: 'GBXYZABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOP',
    votes_yes: 4_200_000,
    votes_no: 1_100_000,
    votes_abstain: 300_000,
    quorum: 5_000_000,
    start_time: now - 86400,
    end_time: now + 3600 * 6,
    state: 'Active',
    execute_after: 0,
  },
  {
    id: 2,
    title: 'Enable admin vote restriction on self-created proposals',
    proposer: 'GCABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRS',
    votes_yes: 8_500_000,
    votes_no: 900_000,
    votes_abstain: 600_000,
    quorum: 5_000_000,
    start_time: now - 172800,
    end_time: now - 3600,
    state: 'Passed',
    execute_after: now + 3600 * 24,
  },
  {
    id: 3,
    title: 'Reduce voting duration maximum from 30 days to 14 days',
    proposer: 'GDABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRS',
    votes_yes: 1_200_000,
    votes_no: 3_800_000,
    votes_abstain: 200_000,
    quorum: 5_000_000,
    start_time: now - 259200,
    end_time: now - 86400,
    state: 'Rejected',
    execute_after: 0,
  },
  {
    id: 4,
    title: 'Deploy governance contract upgrade v1.1.0',
    proposer: 'GEABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRS',
    votes_yes: 9_100_000,
    votes_no: 400_000,
    votes_abstain: 100_000,
    quorum: 5_000_000,
    start_time: now - 604800,
    end_time: now - 518400,
    state: 'Executed',
    execute_after: 0,
  },
  {
    id: 5,
    title: 'Add delegation support to governance contract',
    proposer: 'GFABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRS',
    votes_yes: 500_000,
    votes_no: 200_000,
    votes_abstain: 50_000,
    quorum: 5_000_000,
    start_time: now - 3600,
    end_time: now + 3600 * 47,
    state: 'Active',
    execute_after: 0,
  },
  {
    id: 6,
    title: 'Cancel emergency proposal — superseded by proposal #7',
    proposer: 'GGABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRS',
    votes_yes: 0,
    votes_no: 0,
    votes_abstain: 0,
    quorum: 5_000_000,
    start_time: now - 7200,
    end_time: now + 86400,
    state: 'Cancelled',
    execute_after: 0,
  },
  {
    id: 7,
    title: 'Set proposal cooldown period to 24 hours',
    proposer: 'GHABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRS',
    votes_yes: 2_100_000,
    votes_no: 800_000,
    votes_abstain: 400_000,
    quorum: 5_000_000,
    start_time: now - 43200,
    end_time: now + 3600 * 30,
    state: 'Active',
    execute_after: 0,
  },
  {
    id: 8,
    title: 'Update treasury multisig signers',
    proposer: 'GIABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRS',
    votes_yes: 7_200_000,
    votes_no: 1_300_000,
    votes_abstain: 500_000,
    quorum: 5_000_000,
    start_time: now - 345600,
    end_time: now - 259200,
    state: 'Passed',
    execute_after: now - 172800,
  },
  {
    id: 9,
    title: 'Increase quorum threshold to 10% of total supply',
    proposer: 'GJABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRS',
    votes_yes: 3_000_000,
    votes_no: 3_100_000,
    votes_abstain: 900_000,
    quorum: 5_000_000,
    start_time: now - 432000,
    end_time: now - 345600,
    state: 'Rejected',
    execute_after: 0,
  },
  {
    id: 10,
    title: 'Enable on-chain timelock for all passed proposals',
    proposer: 'GKABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRS',
    votes_yes: 6_800_000,
    votes_no: 700_000,
    votes_abstain: 200_000,
    quorum: 5_000_000,
    start_time: now - 1209600,
    end_time: now - 1123200,
    state: 'Executed',
    execute_after: 0,
  },
  {
    id: 11,
    title: 'Whitelist new token contract address for governance voting',
    proposer: 'GLABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRS',
    votes_yes: 1_500_000,
    votes_no: 500_000,
    votes_abstain: 200_000,
    quorum: 5_000_000,
    start_time: now - 1800,
    end_time: now + 3600 * 71,
    state: 'Active',
    execute_after: 0,
  },
  {
    id: 12,
    title: 'Reduce maximum title length from 256 to 128 characters',
    proposer: 'GMABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRS',
    votes_yes: 4_400_000,
    votes_no: 2_200_000,
    votes_abstain: 800_000,
    quorum: 5_000_000,
    start_time: now - 518400,
    end_time: now - 432000,
    state: 'Passed',
    execute_after: now + 3600 * 12,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a large number with locale-aware thousands separators.
 * @param {number} n
 * @returns {string}
 */
function fmt(n) {
  return n.toLocaleString();
}

/**
 * Truncate a Stellar address to first 6 + last 4 characters.
 * @param {string} addr
 * @returns {string}
 */
function truncateAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Return seconds remaining until a Unix timestamp.
 * @param {number} endTime  Unix timestamp (seconds)
 * @returns {number}
 */
function secondsUntil(endTime) {
  return Math.max(0, endTime - Math.floor(Date.now() / 1000));
}

/**
 * Format a duration in seconds as a human-readable string.
 * @param {number} secs
 * @returns {string}
 */
function formatDuration(secs) {
  if (secs <= 0) return 'Ended';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  if (m > 0) return `${m}m ${s}s remaining`;
  return `${s}s remaining`;
}

/**
 * Return true if fewer than 1 hour remains (used to apply "ending soon" style).
 * @param {number} secs
 * @returns {boolean}
 */
function isEndingSoon(secs) {
  return secs > 0 && secs < 3600;
}

function normalizeFilterKey(value) {
  return String(value || 'all').trim().toLowerCase();
}

function formatDuration(secs) {
  if (secs <= 0) return 'Voting Ended';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function buildQueryParams() {
  const params = new URLSearchParams();
  if (currentPage > 1) params.set('page', String(currentPage));
  if (activeFilter !== 'all') params.set('state', activeFilter);
  if (pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(pageSize));
  return params.toString();
}

function updateUrl() {
  const params = buildQueryParams();
  const url = `${window.location.pathname}${params ? `?${params}` : ''}`;
  window.history.replaceState(null, '', url);
}

function applyUrlState() {
  const params = new URLSearchParams(window.location.search);
  const filter = normalizeFilterKey(params.get('state'));
  if (FILTER_STATES.some((item) => item.key === filter)) {
    activeFilter = filter;
  }

  const page = parseInt(params.get('page'), 10);
  if (!Number.isNaN(page) && page > 0) currentPage = page;

  const size = parseInt(params.get('pageSize'), 10);
  if (PAGE_SIZE_OPTIONS.includes(size)) pageSize = size;
}

function updateFilterLabels() {
  const counts = FILTER_STATES.reduce((acc, filter) => {
    acc[filter.key] = filter.key === 'all'
      ? MOCK_PROPOSALS.length
      : MOCK_PROPOSALS.filter((p) => p.state.toLowerCase() === filter.key).length;
    return acc;
  }, {});

  document.querySelectorAll('.filter-btn').forEach((button) => {
    const filter = normalizeFilterKey(button.dataset.filter);
    const count = counts[filter] ?? 0;
    button.textContent = `${FILTER_STATES.find((f) => f.key === filter)?.label ?? filter} (${count})`;
    button.setAttribute('aria-label', `Show ${button.textContent}`);
  });
}

function renderToast(toast) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  if (!toast) {
    container.innerHTML = '';
    return;
  }

  const statusLabel = {
    [TOAST_STATUS.pending]: 'Pending',
    [TOAST_STATUS.confirmed]: 'Success',
    [TOAST_STATUS.failed]: 'Error',
  }[toast.status] || 'Status';

  const buttonText = toast.status === TOAST_STATUS.failed ? 'Retry' : 'Dismiss';
  const actionButtonHtml = toast.status === TOAST_STATUS.failed
    ? '<button id="toast-retry" type="button">Retry</button>'
    : '';

  container.innerHTML = `
    <div class="toast" role="alert">
      <div class="toast-header">
        <div>
          <div class="toast-title">${toast.label}</div>
          <div class="toast-status ${toast.status}">${statusLabel}</div>
        </div>
        <button id="toast-dismiss" type="button" aria-label="Dismiss notification">×</button>
      </div>
      <div class="toast-body">
        <div>${toast.status === TOAST_STATUS.pending ? 'Your transaction is pending confirmation.' : toast.status === TOAST_STATUS.confirmed ? 'Transaction confirmed successfully.' : 'Transaction failed to complete.'}</div>
        <div>${toast.hash}</div>
        ${toast.error ? `<div style="margin-top:0.5rem;color:#fca5a5;">${toast.error}</div>` : ''}
      </div>
      <div class="toast-actions">
        ${actionButtonHtml}
        <button id="toast-close" type="button">${buttonText}</button>
      </div>
    </div>
  `;

  const retryButton = document.getElementById('toast-retry');
  if (retryButton) {
    retryButton.addEventListener('click', () => {
      if (currentToast && currentToast.status === TOAST_STATUS.failed) {
        submitMockTransaction(currentToast.actionLabel);
      }
    });
  }

  const closeButton = document.getElementById('toast-close');
  if (closeButton) {
    closeButton.addEventListener('click', dismissToast);
  }

  const dismissButton = document.getElementById('toast-dismiss');
  if (dismissButton) {
    dismissButton.addEventListener('click', dismissToast);
  }
}

function showToast(toast) {
  clearTimeout(toastTimer);
  currentToast = toast;
  renderToast(toast);
  if (!toast || toast.status === TOAST_STATUS.pending) return;
  toastTimer = setTimeout(() => {
    currentToast = null;
    renderToast(null);
  }, TOAST_DURATION_MS);
}

function dismissToast() {
  clearTimeout(toastTimer);
  currentToast = null;
  renderToast(null);
}

async function submitMockTransaction(actionLabel) {
  if (!userAddress) {
    alert('Please connect your wallet before submitting transactions.');
    return;
  }

  // SEC-013: Require explicit wallet signature via Freighter
  const freighter = window.freighter;
  if (!freighter) {
    alert('Freighter extension not found.');
    return;
  }

  try {
    // SEC-013: Signature request shows clear action description via 'reason' parameter
    // In a real implementation, we would build and sign a XDR transaction.
    await freighter.signTransaction('', {
      network: 'TESTNET',
      reason: `Sign this transaction to: ${actionLabel}`
    });

    const hash = `tx_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    showToast({
      hash,
      status: TOAST_STATUS.pending,
      label: actionLabel,
      actionLabel,
      error: null,
    });

    setTimeout(() => {
      const failed = Math.random() < 0.2;
      showToast({
        hash,
        status: failed ? TOAST_STATUS.failed : TOAST_STATUS.confirmed,
        label: actionLabel,
        actionLabel,
        error: failed ? `${actionLabel} failed due to a network error.` : null,
      });
    }, 1600);
  } catch (e) {
    console.warn('Transaction cancelled or failed:', e);
    // Unsigned transactions are never submitted (SEC-013)
    if (e.message?.includes('User declined')) {
      alert('Transaction cancelled by user.');
    }
  }
}

function clearToastTimer() {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

/**
 * Map a proposal state string to a CSS class suffix.
 * @param {string} state
 * @returns {string}
 */
function badgeClass(state) {
  return `badge-${state.toLowerCase()}`;
}

// ── Filtering ────────────────────────────────────────────────────────────────

function filteredProposals() {
  return MOCK_PROPOSALS.filter(p => {
    const matchesFilter = activeFilter === 'all' || p.state.toLowerCase() === activeFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q
      || p.title.toLowerCase().includes(q)
      || String(p.id).includes(q)
      || p.proposer.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });
}

// ── Rendering ────────────────────────────────────────────────────────────────

/**
 * Build the HTML for a single proposal card.
 * @param {object} p  Proposal object
 * @returns {string}  HTML string
 */
function renderCard(p) {
  const total = p.votes_yes + p.votes_no + p.votes_abstain;
  const yesP  = total > 0 ? (p.votes_yes     / total * 100).toFixed(1) : 0;
  const noP   = total > 0 ? (p.votes_no      / total * 100).toFixed(1) : 0;
  const absP  = total > 0 ? (p.votes_abstain / total * 100).toFixed(1) : 0;

  const isActive = p.state === 'Active';
  const secs     = isActive ? secondsUntil(p.end_time) : 0;
  const endingSoon = isActive && isEndingSoon(secs);
  const displayTime = secs <= 0 ? 'Voting Ended' : formatDuration(secs);

  const countdownHtml = isActive ? `
    <span class="countdown${endingSoon ? ' ending-soon' : ''}${secs <= 0 ? ' ended' : ''}" data-end="${p.end_time}" data-active="${secs > 0}" aria-label="${secs <= 0 ? 'Voting ended' : `Time remaining: ${displayTime}`}">
      <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.4"/>
        <path d="M7 4v3l2 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
      <span class="countdown-text">${displayTime}</span>
    </span>` : '';

  const quorumMet = total >= p.quorum;
  const quorumPct = p.quorum > 0 ? Math.min(100, (total / p.quorum * 100)).toFixed(0) : 0;

  return `
    <li class="proposal-card" role="article" aria-label="Proposal ${p.id}: ${p.title}">
      <div class="card-header">
        <div class="card-title-row">
          <div class="proposal-id" aria-label="Proposal ID">#${p.id}</div>
          <h2 class="proposal-title">${escapeHtml(p.title)}</h2>
        </div>
        <span class="state-badge ${badgeClass(p.state)}" role="status" aria-label="Status: ${p.state}">
          ${p.state}
        </span>
      </div>

      <div class="vote-summary" aria-label="Vote summary">
        <div class="vote-bar-wrap" role="img" aria-label="Yes ${yesP}%, No ${noP}%, Abstain ${absP}%">
          <div class="vote-bar-yes"     style="width:${yesP}%"></div>
          <div class="vote-bar-no"      style="width:${noP}%"></div>
          <div class="vote-bar-abstain" style="width:${absP}%"></div>
        </div>
        <div class="vote-counts">
          <span class="vote-count-item">
            <span class="vote-dot dot-yes" aria-hidden="true"></span>
            Yes <strong>${fmt(p.votes_yes)}</strong>
          </span>
          <span class="vote-count-item">
            <span class="vote-dot dot-no" aria-hidden="true"></span>
            No <strong>${fmt(p.votes_no)}</strong>
          </span>
          <span class="vote-count-item">
            <span class="vote-dot dot-abstain" aria-hidden="true"></span>
            Abstain <strong>${fmt(p.votes_abstain)}</strong>
          </span>
        </div>
      </div>

      <div class="card-footer">
        <span class="proposer-info">
          <span class="proposer-label">Proposer</span>
          <span class="proposer-address" title="${escapeHtml(p.proposer)}">${truncateAddress(p.proposer)}</span>
        </span>
        <span class="quorum-info" aria-label="Quorum ${quorumPct}% of ${fmt(p.quorum)} required${quorumMet ? ', met' : ', not yet met'}">
          Quorum ${quorumPct}%${quorumMet ? ' ✓' : ''}
        </span>
        ${countdownHtml}
        ${isActive ? `<button class="action-btn vote-btn" type="button" data-action="vote" data-proposal-id="${p.id}">Vote</button>` : ''}
      </div>
    </li>`;
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Countdown tick ────────────────────────────────────────────────────────────

function tickCountdowns() {
  let shouldRefresh = false;

  document.querySelectorAll('.countdown[data-end]').forEach(el => {
    const endTime = parseInt(el.dataset.end, 10);
    const secs    = secondsUntil(endTime);
    const text    = el.querySelector('.countdown-text');
    const wasActive = el.dataset.active === 'true';
    const labelText = secs <= 0 ? 'Voting ended' : `Time remaining: ${formatDuration(secs)}`;

    if (text) text.textContent = formatDuration(secs);
    el.setAttribute('aria-label', labelText);
    el.dataset.active = secs > 0 ? 'true' : 'false';

    if (isEndingSoon(secs)) {
      el.classList.add('ending-soon');
    } else {
      el.classList.remove('ending-soon');
    }

    if (wasActive && secs === 0) {
      shouldRefresh = true;
    }
  });

  if (shouldRefresh) render();
}

// ── Render page ───────────────────────────────────────────────────────────────

function render() {
  // Clear existing countdown intervals
  countdownTimers.forEach(clearInterval);
  countdownTimers = [];

  const list      = document.getElementById('proposal-list');
  const emptyState = document.getElementById('empty-state');
  const prevBtn   = document.getElementById('prev-btn');
  const nextBtn   = document.getElementById('next-btn');
  const pageInfo  = document.getElementById('page-info');
  const liveRegion = document.getElementById('live-region');

  const filtered = filteredProposals();
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Clamp current page
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * pageSize;
  const page = filtered.slice(start, start + pageSize);

  if (page.length === 0) {
    list.innerHTML = '';
    emptyState.hidden = false;
    liveRegion.textContent = 'No proposals match your filter.';
  } else {
    emptyState.hidden = true;
    list.innerHTML = page.map(renderCard).join('');
    liveRegion.textContent = `Showing ${page.length} proposal${page.length !== 1 ? 's' : ''}.`;
  }

  // Pagination controls
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  // Start countdown ticker for active proposals
  if (page.some(p => p.state === 'Active')) {
    const timer = setInterval(tickCountdowns, 1000);
    countdownTimers.push(timer);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  applyUrlState();
  updateFilterLabels();

  const filterButtons = Array.from(document.querySelectorAll('.filter-btn'));
  const pageSizeSelect = document.getElementById('page-size-select');
  const createProposalButton = document.getElementById('create-proposal-btn');
  const walletConnectButton = document.getElementById('wallet-connect-btn');
  const proposalList = document.getElementById('proposal-list');

  if (walletConnectButton) {
    walletConnectButton.addEventListener('click', connectWallet);
  }

  function updateFilterButtonState() {
    filterButtons.forEach((btn) => {
      const isActive = normalizeFilterKey(btn.dataset.filter) === activeFilter;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  updateFilterButtonState();

  // Filter buttons
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = normalizeFilterKey(btn.dataset.filter);
      currentPage = 1;
      updateFilterButtonState();
      updateFilterLabels();
      render();
      updateUrl();
    });
  });

  // Search input — debounced
  let searchTimer;
  document.getElementById('search-input').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = e.target.value.trim();
      currentPage = 1;
      render();
    }, 250);
  });

  // Page size select
  if (pageSizeSelect) {
    pageSizeSelect.value = String(pageSize);
    pageSizeSelect.addEventListener('change', (event) => {
      const selected = parseInt(event.target.value, 10);
      if (PAGE_SIZE_OPTIONS.includes(selected)) {
        pageSize = selected;
        currentPage = 1;
        render();
        updateUrl();
      }
    });
  }

  // Create proposal button
  if (createProposalButton) {
    createProposalButton.addEventListener('click', () => {
      const title = window.prompt('Enter a title for the new proposal');
      if (!title) return;
      submitMockTransaction('Create proposal');
    });
  }

  // Vote buttons and title clicks on proposal cards
  if (proposalList) {
    proposalList.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      const titleLink = event.target.closest('.proposal-title');

      if (button) {
        const action = button.dataset.action;
        const id = button.dataset.proposalId;
        if (action === 'vote' && id) {
          submitMockTransaction(`Vote on proposal #${id}`);
        }
      } else if (titleLink) {
        const card = titleLink.closest('.proposal-card');
        const id = card.querySelector('.proposal-id').textContent.replace('#', '');
        // Simulation: show a mock detail view or alert for now
        console.log(`Navigating to proposal #${id} details...`);
      }
    });
  }

  // Pagination
  document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      render();
      updateUrl();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  document.getElementById('next-btn').addEventListener('click', () => {
    const total = Math.ceil(filteredProposals().length / pageSize);
    if (currentPage < total) {
      currentPage++;
      render();
      updateUrl();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // ── Theme toggle logic ───────────────────────────────────────────────────────
  const themeToggle = document.getElementById('theme-toggle');
  
  function updateThemeToggleUI(isDark) {
    if (!themeToggle) return;
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    themeToggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    themeToggle.innerHTML = isDark
      ? `<svg class="theme-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2"></path>
          <path d="M12 20v2"></path>
          <path d="m4.93 4.93 1.41 1.41"></path>
          <path d="m17.66 17.66 1.41 1.41"></path>
          <path d="M2 12h2"></path>
          <path d="M20 12h2"></path>
          <path d="m6.34 17.66-1.41 1.41"></path>
          <path d="m19.07 4.93-1.41 1.41"></path>
        </svg>`
      : `<svg class="theme-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
        </svg>`;
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      updateThemeToggleUI(isDark);
    });
    // Set initial icon state based on the current class of <html>
    updateThemeToggleUI(document.documentElement.classList.contains('dark'));
  }

  // Initial render
  render();
  updateUrl();
});
