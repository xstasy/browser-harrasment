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
     * Force restore scrolling if site logic blocked it
     */
    function restoreScrolling() {
        log('Restoring scrolling...');
        const elements = [document.documentElement, document.body];
        elements.forEach(el => {
            if (!el) return;
            
            // Remove common scroll-blocking styles
            el.style.setProperty('overflow', 'auto', 'important');
            el.style.setProperty('overflow-x', 'auto', 'important');
            el.style.setProperty('overflow-y', 'auto', 'important');
            el.style.setProperty('position', 'static', 'important');
            el.style.setProperty('height', 'auto', 'important');
            el.style.setProperty('width', 'auto', 'important');
            
            // Remove common scroll-blocking classes if known
            // sp-message-open is clearly used by Schibsted sites
            const blockingClasses = ['sp-message-open', 'cmp-active', 'is-locked', 'no-scroll', 'modal-open'];
            blockingClasses.forEach(cls => {
                if (el.classList.contains(cls)) {
                    el.classList.remove(cls);
                }
            });
        });
    }

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
            const hostname = window.location.hostname;
            const stripoutSelectors = Object.entries(BH_Detector.stripoutSelectors || {})
                .filter(([domain]) => hostname === domain || hostname.endsWith('.' + domain))
                .flatMap(([, selectors]) => selectors);

            // 1. Direct stripout check (even if not found as a "container" yet)
            for (const selector of stripoutSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                    if (!handledContainers.has(el)) {
                        log('Hard-stripping element by selector:', selector);
                        el.style.setProperty('display', 'none', 'important');
                        el.style.setProperty('visibility', 'hidden', 'important');
                        el.style.setProperty('opacity', '0', 'important');
                        el.style.setProperty('pointer-events', 'none', 'important');
                        handledContainers.add(el);
                        restoreScrolling();
                        setTimeout(restoreScrolling, 500);
                        setTimeout(restoreScrolling, 2000);
                    }
                }
            }

            const containers = BH_Detector.findContainers();
            log(`Found ${containers.length} potential consent containers`);

            for (const container of containers) {
                // Skip if already handled
                if (handledContainers.has(container)) {
                    continue;
                }

                // Check for site-specific stripout (hard-hide)
                const hostname = window.location.hostname;
                const stripoutSelectors = Object.entries(BH_Detector.stripoutSelectors || {})
                    .filter(([domain]) => hostname === domain || hostname.endsWith('.' + domain))
                    .flatMap(([, selectors]) => selectors);
                
                let isStripout = false;
                for (const selector of stripoutSelectors) {
                    if (container.matches(selector)) {
                        log('Stripping out container based on site rule:', selector);
                        container.style.setProperty('display', 'none', 'important');
                        container.style.setProperty('visibility', 'hidden', 'important');
                        container.style.setProperty('opacity', '0', 'important');
                        container.style.setProperty('pointer-events', 'none', 'important');
                        
                        handledContainers.add(container);
                        isStripout = true;
                        
                        // Restore scrolling since stripout might leave page locked
                        restoreScrolling();
                        // Also run it after a short delay because site might re-set it
                        setTimeout(restoreScrolling, 500);
                        setTimeout(restoreScrolling, 2000);
                        break;
                    }
                }
                if (isStripout) continue;

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
                        try {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // Optimized check: check ID and Class first (cheap)
                                const id = node.id?.toLowerCase() || '';
                                const className = typeof node.className === 'string' ? node.className.toLowerCase() : '';
                                
                                if (id.includes('cookie') || id.includes('consent') || id.includes('privacy') || id.includes('gdpr') || id.includes('sp_message') ||
                                    className.includes('cookie') || className.includes('consent') || className.includes('privacy') || className.includes('gdpr') || className.includes('cmp')) {
                                    shouldProcess = true;
                                    break;
                                }

                                // Fallback to innerText/textContent snippet if not found in ID/Class, but avoid full outerHTML
                                const textSnippet = (node.textContent || '').slice(0, 1000).toLowerCase();
                                if (textSnippet.includes('cookie') || textSnippet.includes('consent') || textSnippet.includes('privacy')) {
                                    shouldProcess = true;
                                    break;
                                }
                            }
                        } catch (e) {
                            // Ignore errors for individual nodes
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
