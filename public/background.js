const DEFAULT_DOMAINS = [
  'netflix.com',
  'youtube.com',
  'instagram.com',
  'facebook.com',
  'twitter.com',
  'tiktok.com'
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

function shouldBlockUrl(url, blockedDomains, unlockedSites) {
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith('http')) return false;
    if (parsed.origin === chrome.runtime.getOrigin()) return false;

    const key = getBlockedDomainKey(parsed.hostname, blockedDomains);
    if (!key) return false;

    const now = Date.now();
    if (unlockedSites[key] && unlockedSites[key] >= now) return false;

    return true;
  } catch {
    return false;
  }
}

async function redirectTabToQuiz(tab, extensionPage) {
  if (!tab.id || !tab.url) return;

  const redirectUrl = `${extensionPage}?target=${encodeURIComponent(tab.url)}`;

  try {
    await chrome.tabs.update(tab.id, { url: redirectUrl });
    return;
  } catch (e) {
    console.warn('tabs.update failed, trying scripting', tab.id, e);
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (url) => { location.replace(url); },
      args: [redirectUrl],
    });
  } catch (e) {
    console.warn('scripting redirect failed', tab.id, e);
  }
}

async function redirectOpenBlockedTabs(isBlocking, domains, unlockedSites = {}) {
  if (!isBlocking || !domains?.length) return;

  const tabs = await chrome.tabs.query({});
  const extensionPage = chrome.runtime.getURL('index.html');

  for (const tab of tabs) {
    if (!shouldBlockUrl(tab.url, domains, unlockedSites)) continue;
    await redirectTabToQuiz(tab, extensionPage);
  }
}

async function toggleBlocking(isBlocking, domains, unlockedSites = {}) {
  const allRulesContext = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = allRulesContext.map(rule => rule.id);

  if (!isBlocking || !domains || domains.length === 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldRuleIds,
      addRules: []
    });
    return;
  }

  const now = Date.now();
  const activeDomains = domains.filter(domain => {
    return !unlockedSites[domain] || unlockedSites[domain] < now;
  });

  const newRules = activeDomains.map((domain, index) => {
    const escapedDomain = domain.replace(/\./g, '\\.');
    return {
      id: index + 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          regexSubstitution: chrome.runtime.getURL("index.html") + "?target=\\0"
        }
      },
      condition: {
        regexFilter: "^https?://(?:[a-zA-Z0-9-]+\\.)?" + escapedDomain + "(?:/.*)?",
        resourceTypes: ["main_frame"]
      }
    };
  });

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRuleIds,
    addRules: newRules
  });
}

async function notifyTabsToUpdateTimer() {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_TIMER' });
    } catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['timer.js'],
        });
      } catch {
        // Tab may not allow injection (chrome://, etc.)
      }
    }
  }
}

async function refreshBlockingRules() {
  const data = await chrome.storage.local.get(['isBlocking', 'blockedDomains', 'unlockedSites']);
  const isBlocking = data.isBlocking ?? false;
  const blockedDomains = data.blockedDomains ?? DEFAULT_DOMAINS;
  const unlockedSites = data.unlockedSites ?? {};

  await toggleBlocking(isBlocking, blockedDomains, unlockedSites);
  if (isBlocking) {
    await redirectOpenBlockedTabs(isBlocking, blockedDomains, unlockedSites);
  }
  await notifyTabsToUpdateTimer();
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.isBlocking || changes.blockedDomains || changes.unlockedSites)) {
    refreshBlockingRules().catch(console.error);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'REFRESH_RULES') {
    refreshBlockingRules()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error(err);
        sendResponse({ ok: false });
      });
    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("relock_")) {
    const domain = alarm.name.replace("relock_", "");
    chrome.storage.local.get(['unlockedSites'], (data) => {
      const unlockedSites = data.unlockedSites || {};
      if (unlockedSites[domain]) {
        delete unlockedSites[domain];
        chrome.storage.local.set({ unlockedSites });
      }
    });
  }
});

async function initializeExtension() {
  const data = await chrome.storage.local.get(['isBlocking', 'blockedDomains', 'unlockedSites']);
  const isBlocking = data.isBlocking ?? false;
  const blockedDomains = data.blockedDomains ?? DEFAULT_DOMAINS;
  const unlockedSites = { ...(data.unlockedSites ?? {}) };

  const now = Date.now();
  for (const domain in unlockedSites) {
    if (unlockedSites[domain] < now) {
      delete unlockedSites[domain];
    }
  }

  await chrome.storage.local.set({ isBlocking, blockedDomains, unlockedSites });
  await toggleBlocking(isBlocking, blockedDomains, unlockedSites);
  if (isBlocking) {
    await redirectOpenBlockedTabs(isBlocking, blockedDomains, unlockedSites);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  initializeExtension().catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  initializeExtension().catch(console.error);
});
