// Browser Harassment - Background Service Worker
// Manages extension state, statistics, and messaging

const DEFAULT_SETTINGS = {
  enabled: true,
  whitelist: [],
  stats: {
    popupsHandled: 0,
    sitesWithIssues: []
  }
};

// Initialize settings on install
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get('settings');
  if (!stored.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  console.log('[Browser Harassment] Extension installed/updated');
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  const data = await chrome.storage.local.get('settings');
  const settings = data.settings || DEFAULT_SETTINGS;

  switch (message.type) {
    case 'GET_SETTINGS':
      return { settings };

    case 'CHECK_ENABLED':
      const url = new URL(sender.tab?.url || message.url);
      const isWhitelisted = settings.whitelist.some(domain =>
        url.hostname.includes(domain)
      );
      return {
        enabled: settings.enabled && !isWhitelisted,
        isWhitelisted
      };

    case 'POPUP_HANDLED':
      settings.stats.popupsHandled++;
      await chrome.storage.local.set({ settings });
      updateBadge(settings.stats.popupsHandled);
      return { success: true };

    case 'POPUP_FAILED':
      if (!settings.stats.sitesWithIssues.includes(message.hostname)) {
        settings.stats.sitesWithIssues.push(message.hostname);
        await chrome.storage.local.set({ settings });
      }
      return { success: true };

    case 'TOGGLE_ENABLED':
      settings.enabled = message.enabled;
      await chrome.storage.local.set({ settings });
      return { settings };

    case 'ADD_TO_WHITELIST':
      if (!settings.whitelist.includes(message.hostname)) {
        settings.whitelist.push(message.hostname);
        await chrome.storage.local.set({ settings });
      }
      return { settings };

    case 'REMOVE_FROM_WHITELIST':
      settings.whitelist = settings.whitelist.filter(d => d !== message.hostname);
      await chrome.storage.local.set({ settings });
      return { settings };

    case 'GET_STATS':
      return { stats: settings.stats };

    case 'RESET_STATS':
      settings.stats = { popupsHandled: 0, sitesWithIssues: [] };
      await chrome.storage.local.set({ settings });
      updateBadge(0);
      return { stats: settings.stats };

    default:
      return { error: 'Unknown message type' };
  }
}

function updateBadge(count) {
  const text = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
}

// Initialize badge on startup
chrome.storage.local.get('settings').then(({ settings }) => {
  if (settings?.stats?.popupsHandled) {
    updateBadge(settings.stats.popupsHandled);
  }
});
