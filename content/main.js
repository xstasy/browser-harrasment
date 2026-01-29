// Browser Harassment - Main Content Script
// Orchestrates detection, automation, and fallback

(async function () {
    'use strict';

    const DEBUG = false;
    const log = (...args) => DEBUG && console.log('[Browser Harassment]', ...args);

    // Check if extension is enabled for this site
    async function checkEnabled() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'CHECK_ENABLED' });
            return response?.enabled ?? true;
        } catch (e) {
            // Extension context may be invalidated
            return false;
        }
    }

    // Report successful popup handling
    async function reportSuccess() {
        try {
            await chrome.runtime.sendMessage({ type: 'POPUP_HANDLED' });
        } catch (e) {
            // Ignore
        }
    }

    // Track handled containers to avoid duplicate processing
    const handledContainers = new WeakSet();
    let isProcessing = false;

    /**
     * Main processing function
     */
    async function processPage() {
        if (isProcessing) return;

        const enabled = await checkEnabled();
        if (!enabled) {
            log('Extension disabled for this site');
            return;
        }

        isProcessing = true;

        try {
            const containers = BH_Detector.findContainers();
            log(`Found ${containers.length} potential consent containers`);

            for (const container of containers) {
                // Skip if already handled
                if (handledContainers.has(container)) {
                    continue;
                }

                // Skip if not a consent popup
                if (!BH_Detector.isConsentPopup(container)) {
                    continue;
                }

                log('Processing container:', container);
                handledContainers.add(container);

                // Try to handle the popup
                const result = await BH_Automator.handlePopup(container);

                if (result.success) {
                    log('Successfully handled popup via:', result.method);
                    await reportSuccess();
                } else {
                    log('Could not automatically reject consent');

                    // Check if this is a blocking overlay with only accept option
                    if (BH_Automator.isBlockingOverlay(container) &&
                        BH_Automator.hasOnlyAcceptOption(container)) {
                        log('Showing fallback warning');
                        BH_Fallback.showWarning(container);
                    }
                }
            }
        } catch (e) {
            console.error('[Browser Harassment] Error processing page:', e);
        } finally {
            isProcessing = false;
        }
    }

    /**
     * Debounce function
     */
    function debounce(fn, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // Debounced version for mutation observer
    const debouncedProcess = debounce(processPage, 300);

    /**
     * Set up mutation observer to detect dynamically added popups
     */
    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            // Check if any mutations might have added a consent popup
            let shouldProcess = false;

            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Quick check for consent-related content
                            const html = node.outerHTML?.toLowerCase() || '';
                            if (html.includes('cookie') ||
                                html.includes('consent') ||
                                html.includes('privacy') ||
                                html.includes('gdpr')) {
                                shouldProcess = true;
                                break;
                            }
                        }
                    }
                }

                if (shouldProcess) break;
            }

            if (shouldProcess) {
                debouncedProcess();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return observer;
    }

    /**
     * Initialize
     */
    async function init() {
        log('Initializing...');

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                processPage();
                setupObserver();
            });
        } else {
            // DOM already ready
            await processPage();
            setupObserver();
        }

        // Also run after a short delay to catch late-loading popups
        setTimeout(processPage, 1000);
        setTimeout(processPage, 3000);
    }

    // Start
    init();
})();
