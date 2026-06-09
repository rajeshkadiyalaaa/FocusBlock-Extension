if (window.__focusBlockTimerLoaded) {
  // Allow background to force a refresh without duplicate listeners
  if (typeof window.__focusBlockUpdateTimer === 'function') {
    window.__focusBlockUpdateTimer();
  }
} else {
  window.__focusBlockTimerLoaded = true;

  const DEFAULT_DOMAINS = [
    'netflix.com',
    'youtube.com',
    'instagram.com',
    'facebook.com',
    'twitter.com',
    'tiktok.com',
  ];

  function getBlockedDomainKey(hostname, blockedDomains) {
    const host = hostname.replace(/^www\./, '').toLowerCase();
    const sorted = [...blockedDomains].sort((a, b) => b.length - a.length);
    for (const domain of sorted) {
      const d = domain.toLowerCase();
      if (host === d || host.endsWith('.' + d)) return d;
    }
    return null;
  }

  function shouldBlockCurrentPage(isBlocking, blockedDomains, unlockedSites) {
    if (!isBlocking) return false;
    const key = getBlockedDomainKey(location.hostname, blockedDomains);
    if (!key) return false;
    const now = Date.now();
    if (unlockedSites[key] && unlockedSites[key] >= now) return false;
    return true;
  }

  function redirectToQuiz() {
    const quizUrl =
      chrome.runtime.getURL('index.html') + '?target=' + encodeURIComponent(location.href);
    location.replace(quizUrl);
  }

  function formatRemaining(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  let timerHost = null;
  let tickInterval = null;

  function removeTimer() {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    const el = document.getElementById('focusblock-unlock-timer');
    if (el) el.remove();
    timerHost = null;
  }

  function getMountParent() {
    return document.body || document.documentElement;
  }

  function createTimerElement() {
    const existing = document.getElementById('focusblock-unlock-timer');
    if (existing) {
      timerHost = existing;
      return true;
    }

    const parent = getMountParent();
    if (!parent) return false;

    const host = document.createElement('div');
    host.id = 'focusblock-unlock-timer';
    host.style.cssText = [
      'position:fixed',
      'top:50%',
      'right:12px',
      'transform:translateY(-50%)',
      'z-index:2147483647',
      'pointer-events:none',
      'font-family:ui-sans-serif,system-ui,sans-serif',
    ].join(';');

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        .wrap {
          background: rgba(28, 25, 23, 0.95);
          color: #fafaf9;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 16px;
          padding: 12px 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.28);
          min-width: 88px;
          text-align: center;
          backdrop-filter: blur(10px);
        }
        .time {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.05em;
          line-height: 1.1;
          font-variant-numeric: tabular-nums;
        }
        .label {
          margin-top: 6px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #a8a29e;
        }
        @media (prefers-color-scheme: light) {
          .wrap {
            background: rgba(255, 255, 255, 0.97);
            color: #1c1917;
            border-color: rgba(0,0,0,0.1);
          }
          .label { color: #78716c; }
        }
      </style>
      <div class="wrap">
        <div class="time" id="fb-time">30:00</div>
        <div class="label">Unlocked</div>
      </div>
    `;

    parent.appendChild(host);
    timerHost = host;
    return true;
  }

  async function enforceBlocking() {
    const data = await chrome.storage.local.get(['isBlocking', 'blockedDomains', 'unlockedSites']);
    const isBlocking = data.isBlocking ?? false;
    const blockedDomains = data.blockedDomains ?? DEFAULT_DOMAINS;
    const unlockedSites = data.unlockedSites ?? {};

    if (shouldBlockCurrentPage(isBlocking, blockedDomains, unlockedSites)) {
      redirectToQuiz();
      return true;
    }
    return false;
  }

  async function updateTimer() {
    const data = await chrome.storage.local.get(['isBlocking', 'blockedDomains', 'unlockedSites']);
    const isBlocking = data.isBlocking ?? false;
    const blockedDomains = data.blockedDomains ?? DEFAULT_DOMAINS;
    const unlockedSites = data.unlockedSites ?? {};

    if (!isBlocking) {
      removeTimer();
      return;
    }

    const key = getBlockedDomainKey(location.hostname, blockedDomains);
    if (!key || !unlockedSites[key]) {
      removeTimer();
      return;
    }

    const remaining = unlockedSites[key] - Date.now();
    if (remaining <= 0) {
      removeTimer();
      redirectToQuiz();
      return;
    }

    if (!createTimerElement() || !timerHost?.shadowRoot) return;

    const timeEl = timerHost.shadowRoot.getElementById('fb-time');
    if (timeEl) timeEl.textContent = formatRemaining(remaining);
  }

  window.__focusBlockUpdateTimer = updateTimer;

  function startTimerLoop() {
    updateTimer();
    if (!tickInterval) {
      tickInterval = setInterval(updateTimer, 1000);
    }
  }

  async function init() {
    const blocked = await enforceBlocking();
    if (!blocked) startTimerLoop();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.isBlocking || changes.blockedDomains || changes.unlockedSites) {
      enforceBlocking().then((blocked) => {
        if (!blocked) updateTimer();
      });
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'UPDATE_TIMER') {
      enforceBlocking().then((blocked) => {
        if (!blocked) startTimerLoop();
      });
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('load', () => updateTimer());
}
