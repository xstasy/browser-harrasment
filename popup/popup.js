// Browser Harassment - Popup Script (Paranoid Hardened Version)

console.log('[Browser Harassment] Popup script version 2.1 (Ultra-Safe) loading...');

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Browser Harassment] DOMContentLoaded reached');

    // DOM Elements with safe gathering
    const getEl = (id) => document.getElementById(id);
    const enabledToggle = getEl('enabled-toggle');
    const popupsToday = getEl('popups-today');
    const sitesIssues = getEl('sites-issues');
    const currentSite = getEl('current-site');
    const protectionStatus = getEl('protection-status');
    const statusText = getEl('status-text');
    const whitelistBtn = getEl('whitelist-btn');
    const whitelistBtnText = getEl('whitelist-btn-text');
    const whitelistEl = getEl('whitelist');
    const tabTriggers = document.querySelectorAll('.tab-trigger') || [];
    const tabContents = document.querySelectorAll('.tab-content') || [];

    let currentHostname = '';
    let settings = {
        enabled: true,
        whitelist: [],
        stats: { popupsHandled: 0, sitesWithIssues: [] }
    };

    // --- State Management ---

    async function loadState() {
        console.log('[Browser Harassment] loadState() started');
        try {
            // Check if chrome.runtime is available (it might be during reload)
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                console.error('[Browser Harassment] chrome.runtime API not available');
                return;
            }

            const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            console.log('[Browser Harassment] loadState response:', response);

            if (response && response.settings) {
                settings = response.settings;
            } else {
                console.warn('[Browser Harassment] No settings in response, using defaults');
            }

            // Update UI components with safety
            if (enabledToggle) enabledToggle.checked = !!settings.enabled;
            updateStatusUI();

            if (popupsToday) popupsToday.textContent = settings.stats?.popupsHandled ?? 0;
            if (sitesIssues) sitesIssues.textContent = settings.stats?.sitesWithIssues?.length ?? 0;

            renderWhitelist();

            // Safe tab query
            if (chrome.tabs && chrome.tabs.query) {
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab && tab.url) {
                        try {
                            const url = new URL(tab.url);
                            currentHostname = url.hostname;
                            if (currentSite) currentSite.textContent = currentHostname;
                            updateWhitelistButton();
                        } catch (e) {
                            if (currentSite) currentSite.textContent = 'browser interaction';
                        }
                    } else if (currentSite) {
                        currentSite.textContent = 'browser interaction';
                    }
                } catch (e) {
                    console.error('[Browser Harassment] Tab query exception:', e);
                }
            }
        } catch (e) {
            console.error('[Browser Harassment] loadState top-level catch:', e);
        }
    }

    function updateStatusUI() {
        if (!statusText || !protectionStatus) return;

        if (settings && settings.enabled) {
            statusText.textContent = 'Protection is ON';
            protectionStatus.classList.remove('disabled');
        } else {
            statusText.textContent = 'Protection is OFF';
            protectionStatus.classList.add('disabled');
        }
    }

    function renderWhitelist() {
        if (!whitelistEl) return;

        const list = settings?.whitelist || [];
        if (list.length === 0) {
            whitelistEl.innerHTML = '<li class="empty-msg">No whitelisted sites</li>';
            return;
        }

        whitelistEl.innerHTML = list.map(domain => `
            <li>
                <span>${domain}</span>
                <button class="icon-btn whitelist-remove" data-domain="${domain}" title="Remove">✕</button>
            </li>
        `).join('');

        // Re-attach remove listeners safely
        const btns = whitelistEl.querySelectorAll('.whitelist-remove');
        if (btns) {
            btns.forEach(btn => {
                if (btn) {
                    btn.addEventListener('click', async (e) => {
                        const domain = e.currentTarget.dataset.domain;
                        if (domain) await removeFromWhitelist(domain);
                    });
                }
            });
        }
    }

    function updateWhitelistButton() {
        if (!currentHostname || !whitelistBtn || !whitelistBtnText) return;
        const list = settings?.whitelist || [];
        const isWhitelisted = list.includes(currentHostname);

        if (isWhitelisted) {
            whitelistBtnText.textContent = 'Remove from Whitelist';
            whitelistBtn.classList.add('active');
        } else {
            whitelistBtnText.textContent = 'Whitelist this site';
            whitelistBtn.classList.remove('active');
        }
    }

    // --- Tab Logic ---

    if (tabTriggers && tabTriggers.forEach) {
        tabTriggers.forEach(trigger => {
            if (trigger) {
                trigger.addEventListener('click', () => {
                    const targetTab = trigger.dataset.tab;
                    if (!targetTab) return;

                    tabTriggers.forEach(t => t && t.classList.remove('active'));
                    trigger.classList.add('active');

                    if (tabContents) {
                        tabContents.forEach(content => {
                            if (content) {
                                content.classList.remove('active');
                                if (content.id === `tab-${targetTab}`) {
                                    content.classList.add('active');
                                }
                            }
                        });
                    }
                });
            }
        });
    }

    // --- Interactions ---

    if (enabledToggle) {
        enabledToggle.addEventListener('change', async () => {
            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'TOGGLE_ENABLED',
                    enabled: enabledToggle.checked
                });
                if (response && response.settings) {
                    settings = response.settings;
                }
                updateStatusUI();
            } catch (e) {
                console.error('[Browser Harassment] Toggle failed:', e);
            }
        });
    }

    if (whitelistBtn) {
        whitelistBtn.addEventListener('click', async () => {
            if (!currentHostname) return;
            const list = settings?.whitelist || [];
            const isWhitelisted = list.includes(currentHostname);

            try {
                if (isWhitelisted) {
                    await removeFromWhitelist(currentHostname);
                } else {
                    const response = await chrome.runtime.sendMessage({
                        type: 'ADD_TO_WHITELIST',
                        hostname: currentHostname
                    });
                    if (response && response.settings) {
                        settings = response.settings;
                    }
                }
                renderWhitelist();
                updateWhitelistButton();
            } catch (e) {
                console.error('[Browser Harassment] Whitelist action failed:', e);
            }
        });
    }

    async function removeFromWhitelist(domain) {
        if (!domain) return;
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'REMOVE_FROM_WHITELIST',
                hostname: domain
            });
            if (response && response.settings) {
                settings = response.settings;
            }
            renderWhitelist();
            updateWhitelistButton();
        } catch (e) {
            console.error('[Browser Harassment] Remove from whitelist failed:', e);
        }
    }

    // --- Init ---
    try {
        await loadState();
        console.log('[Browser Harassment] Init complete');
    } catch (e) {
        console.error('[Browser Harassment] Init failed:', e);
    }
});
