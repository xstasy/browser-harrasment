// Browser Harassment - CMP Detection Engine
// Detects privacy/cookie consent popups and their elements

const BH_Detector = {
    // Selectors that should be hidden on specific domains
    stripoutSelectors: {
        'vg.no': ['[id^="sp_message_container"]', '.sp_message_container'],
        'tek.no': ['[id^="sp_message_container"]', '.sp_message_container'],
        'aftenposten.no': ['[id^="sp_message_container"]', '.sp_message_container'],
        'e24.no': ['[id^="sp_message_container"]', '.sp_message_container'],
        'bt.no': ['[id^="sp_message_container"]', '.sp_message_container'],
        'aftenbladet.no': ['[id^="sp_message_container"]', '.sp_message_container', '#sp_message_container_1485780'],
        'godt.no': ['[id^="sp_message_container"]', '.sp_message_container'],
        'mirror.co.uk': ['.pp-prompt']
    },

    // Custom fixes for specific sites that need more than just element hiding
    siteFixes: {
        'avisa-valdres.no': {
            styles: [
                { selector: '#aid-overlay', properties: { 'z-index': '0' } }
            ],
            classesToRemove: [
                { selector: '.aid-background-blur', classes: ['aid-background-blur'] }
            ]
        },
        't-a.no': {
            styles: [
                { selector: '#aid-overlay', properties: { 'z-index': '0' } }
            ],
            classesToRemove: [
                { selector: '.aid-background-blur', classes: ['aid-background-blur'] }
            ]
        }
    },

    // Common CMP container selectors
    containerSelectors: [
        // Generic patterns
        '[class*="cookie-consent"]',
        '[class*="cookie-banner"]',
        '[class*="cookie-notice"]',
        '[class*="cookie-popup"]',
        '[class*="cookie-modal"]',
        '[class*="consent-banner"]',
        '[class*="consent-popup"]',
        '[class*="consent-modal"]',
        '[class*="consent-manager"]',
        '[class*="privacy-banner"]',
        '[class*="privacy-popup"]',
        '[class*="privacy-notice"]',
        '[class*="gdpr-banner"]',
        '[class*="gdpr-popup"]',
        '[class*="ccpa-banner"]',
        '[id*="cookie-consent"]',
        '[id*="cookie-banner"]',
        '[id*="consent-banner"]',
        '[id*="privacy-banner"]',
        '[id*="gdpr"]',
        '[id*="ccpa"]',

        // Specific CMPs
        '#onetrust-consent-sdk',
        '#onetrust-banner-sdk',
        '.onetrust-pc-dark-filter',
        '#didomi-host',
        '#didomi-popup',
        '.didomi-popup-container',
        '#truste-consent-track',
        '#trustarc-banner-container',
        '#cookiebot',
        '#CybotCookiebotDialog',
        '#CybotCookiebotDialogBodyContent',
        '.cc-window',
        '.cc-banner',
        '#quantcast-choice',
        '.qc-cmp-ui-container',
        '.evidon-consent-dialog',
        '#sp_message_container',
        '[id^="sp_message_container"]',
        '.cmp-container',
        '.cmp-popup',
        '.cmp-modal',
        '#usercentrics-root',
        '.iubenda-cs-container',
        '#iubenda-cs-banner',
        '.klaro',
        '.cookie-law-info-bar',
        '#moove_gdpr_cookie_info_bar',
        '.pf-consent',
        '#ez-cookie-notification',
        '.fc-consent-root',
        '#fc-dialog-container',

        // Ethyca / Fides.js
        '#fides-banner',
        '#fides-modal',
        '#fides-overlay',
        '.fides-overlay',
        '.fides-banner',
        '.fides-modal',
        '#fides-consent-modal',

        // WPConsent
        '.wpconsent-banner',
        '#wpconsent-banner',
        '.wpconsent-banner-footer'
    ],

    // Text patterns that indicate a consent popup
    consentTextPatterns: [
        /we (use|value) (your )?privacy/i,
        /cookie(s)? (consent|policy|notice|preferences)/i,
        /privacy (policy|settings|preferences|notice)/i,
        /gdpr|ccpa|data protection/i,
        /we (and our partners|use cookies)/i,
        /accept (all )?cookies/i,
        /manage (your )?preferences/i,
        /consent to (the use of|our)/i,
        /this (website|site) uses cookies/i,
        /your privacy (is important|matters)/i,
        /personalized (ads|advertising|content)/i,
        /third[- ]party (cookies|partners|vendors)/i
    ],

    // Button text patterns for rejection
    rejectButtonPatterns: [
        /^reject(\s+all)?$/i,
        /^decline(\s+all)?$/i,
        /^deny(\s+all)?$/i,
        /^refuse(\s+all)?$/i,
        /^disagree$/i,
        /^no,?\s*thanks?$/i,
        /^only\s*(essential|necessary|required)/i,
        /^use\s*(essential|necessary|required)\s*only/i,
        /^continue\s*without\s*(accepting|consent)/i,
        /^do\s*not\s*(accept|consent|agree)/i,
        /^opt[- ]?out(\s+all)?$/i,
        /^withdraw\s*consent$/i,
        /^opt\s*out\s*of\s*all$/i,
        /^opt\s*out$/i,
        /^wpconsent-cancel-all$/i
    ],

    // Button text patterns for "more options"
    moreOptionsPatterns: [
        /^more\s*(options|info|information)?$/i,
        /^manage\s*(options|preferences|settings|cookies)?$/i,
        /^customize(\s+settings)?$/i,
        /^settings$/i,
        /^preferences$/i,
        /^cookie\s*settings$/i,
        /^privacy\s*settings$/i,
        /^configure$/i,
        /^show\s*(purposes|details|more)$/i,
        /^advanced(\s+settings)?$/i,
        /^your\s*privacy\s*choices$/i
    ],

    // Button text patterns for save/confirm
    saveButtonPatterns: [
        /^save(\s*(and|&)?\s*(exit|close|continue))?$/i,
        /^confirm(\s*(my\s*)?choices?)?$/i,
        /^apply(\s*(my\s*)?choices?)?$/i,
        /^submit$/i,
        /^done$/i,
        /^ok$/i,
        /^close$/i,
        /^accept\s*(my\s*)?(selection|choices?)/i
    ],

    // Tab patterns for IAB TCF
    tabPatterns: {
        purposes: /^purposes?$/i,
        features: /^features?$/i,
        partners: /^(partners?|vendors?)$/i,
        legitimateInterest: /^legitimate\s*interest$/i
    },

    /**
     * Find consent popup containers in the document
     */
    findContainers(root = document) {
        const containers = [];

        // Check main document
        for (const selector of this.containerSelectors) {
            try {
                const elements = root.querySelectorAll(selector);
                containers.push(...elements);
            } catch (e) {
                // Invalid selector, skip
            }
        }

        // Check for overlays/modals that might be consent popups
        const modals = root.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
        for (const modal of modals) {
            if (this.isConsentPopup(modal)) {
                containers.push(modal);
            }
        }

        // Check fixed/absolute positioned elements that cover the page
        const fixedElements = root.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"]');
        for (const el of fixedElements) {
            if (this.isConsentPopup(el)) {
                containers.push(el);
            }
        }

        // Check Shadow DOMs
        const shadowHosts = root.querySelectorAll('*');
        for (const host of shadowHosts) {
            if (host.shadowRoot) {
                containers.push(...this.findContainers(host.shadowRoot));
            }
        }

        // Deduplicate and filter: only keep the outermost containers
        const unique = [...new Set(containers)].filter(el => this.isVisible(el));

        return unique.filter(el => {
            // Check if this element is a descendant of any other container in the list
            return !unique.some(other => {
                if (other === el) return false;
                try {
                    return other.contains(el);
                } catch (e) {
                    return false;
                }
            });
        });
    },

    /**
     * Check if an element is a consent popup by its text content
     */
    isConsentPopup(element) {
        const text = element.textContent || '';
        return this.consentTextPatterns.some(pattern => pattern.test(text));
    },

    /**
     * Check if element is visible
     */
    isVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const isHidden = style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0';
        
        if (isHidden) return false;

        // Fixed position elements have null offsetParent but are visible
        if (style.position === 'fixed') return true;
        
        return element.offsetParent !== null || element.getClientRects().length > 0;
    },

    /**
     * Find element by selector, searching into Shadow DOMs
     */
    findElement(container, selector) {
        if (!container) return null;

        // Try direct query first
        try {
            const el = container.querySelector(selector);
            if (el) return el;
        } catch (e) { }

        // Search recursively
        const search = (root) => {
            const all = root.querySelectorAll('*');
            for (const el of all) {
                try {
                    if (el.matches(selector)) return el;
                } catch (e) { }

                if (el.shadowRoot) {
                    const found = search(el.shadowRoot);
                    if (found) return found;
                }
            }
            return null;
        };

        return search(container);
    },

    /**
     * Find clickable elements (buttons, links, etc.)
     */
    findClickableElements(container) {
        const selectors = [
            'button',
            '[role="button"]',
            'a[href]',
            'input[type="button"]',
            'input[type="submit"]',
            '[onclick]',
            '[class*="btn"]',
            '[class*="button"]',
            '[tabindex="0"]',
            '[data-testid*="-btn"]'
        ];

        const elements = [];

        const search = (root) => {
            for (const selector of selectors) {
                try {
                    elements.push(...root.querySelectorAll(selector));
                } catch (e) { }
            }

            // Recurse into Shadow DOMs
            const all = root.querySelectorAll('*');
            for (const el of all) {
                if (el.shadowRoot) {
                    search(el.shadowRoot);
                }
            }
        };

        search(container);

        return elements.filter(el => this.isVisible(el));
    },

    /**
     * Find button matching patterns
     */
    findButtonByPatterns(container, patterns) {
        const clickables = this.findClickableElements(container);

        for (const pattern of patterns) {
            for (const el of clickables) {
                const text = (el.textContent || el.value || el.getAttribute('aria-label') || el.getAttribute('data-testid') || el.id || '').trim();
                if (pattern.test(text)) {
                    return el;
                }
            }
        }

        return null;
    },

    /**
     * Find reject button
     */
    findRejectButton(container) {
        return this.findButtonByPatterns(container, this.rejectButtonPatterns);
    },

    /**
     * Find "more options" button
     */
    findMoreOptionsButton(container) {
        return this.findButtonByPatterns(container, this.moreOptionsPatterns);
    },

    /**
     * Find save/confirm button
     */
    findSaveButton(container) {
        return this.findButtonByPatterns(container, this.saveButtonPatterns);
    },

    /**
     * Find toggle switches in a container
     */
    findToggles(container) {
        const toggles = [];

        // Standard checkboxes
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        toggles.push(...checkboxes);

        // ARIA switches
        const switches = container.querySelectorAll('[role="switch"], [role="checkbox"]');
        toggles.push(...switches);

        // Custom toggles (On/Off buttons or aria-pressed)
        const buttons = container.querySelectorAll('button, [role="button"]');
        for (const btn of buttons) {
            const text = (btn.textContent || '').trim().toLowerCase();
            const ariaPressed = btn.getAttribute('aria-pressed');

            if (text === 'on' || text === 'off' || ariaPressed !== null) {
                toggles.push(btn);
            }
        }

        // Toggle containers with class patterns
        const customToggles = container.querySelectorAll(
            '[class*="toggle"], [class*="switch"], [class*="slider"]'
        );
        toggles.push(...customToggles);

        return [...new Set(toggles)].filter(el => this.isVisible(el));
    },

    /**
     * Find tabs in IAB TCF style popups
     */
    findTabs(container) {
        const tabs = {
            purposes: null,
            features: null,
            partners: null,
            legitimateInterest: null
        };

        const tabElements = container.querySelectorAll(
            '[role="tab"], [class*="tab"], button, a'
        );

        for (const el of tabElements) {
            const text = (el.textContent || '').trim();
            for (const [key, pattern] of Object.entries(this.tabPatterns)) {
                if (pattern.test(text)) {
                    tabs[key] = el;
                }
            }
        }

        return tabs;
    },

    /**
     * Check if toggle is currently enabled/on
     */
    isToggleEnabled(toggle) {
        // Checkbox
        if (toggle.type === 'checkbox') {
            return toggle.checked;
        }

        // ARIA checked or pressed
        const ariaChecked = toggle.getAttribute('aria-checked');
        if (ariaChecked !== null) {
            return ariaChecked === 'true';
        }
        const ariaPressed = toggle.getAttribute('aria-pressed');
        if (ariaPressed !== null) {
            return ariaPressed === 'true';
        }

        // On/Off text buttons
        const text = (toggle.textContent || '').trim().toLowerCase();
        if (text === 'on') return true;
        if (text === 'off') return false;

        // Check for active/selected class
        const classList = toggle.className.toLowerCase();
        if (classList.includes('active') || classList.includes('selected') || classList.includes('checked')) {
            return true;
        }

        // Check parent or sibling for state
        const parent = toggle.parentElement;
        if (parent) {
            const parentClass = parent.className.toLowerCase();
            if (parentClass.includes('active') || parentClass.includes('on') || parentClass.includes('checked')) {
                return true;
            }
        }

        return false;
    },

    /**
     * Get the "Off" button for toggle pairs (On/Off buttons)
     */
    getOffButton(toggle) {
        const parent = toggle.closest('[class*="toggle"], [class*="switch"], [role="group"]') || toggle.parentElement;
        if (!parent) return null;

        const buttons = parent.querySelectorAll('button, [role="button"]');
        for (const btn of buttons) {
            if ((btn.textContent || '').trim().toLowerCase() === 'off') {
                return btn;
            }
        }

        return null;
    }
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.BH_Detector = BH_Detector;
}
