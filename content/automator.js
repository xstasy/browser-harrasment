// Browser Harassment - Consent Automator
// Automatically rejects consent and toggles off all tracking options

const BH_Automator = {
    // Delay between actions for reliability
    actionDelay: 150,

    /**
     * Wait for specified milliseconds
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Safely click an element with retry
     */
    async click(element, retries = 3) {
        if (!element) return false;

        for (let i = 0; i < retries; i++) {
            try {
                // Ensure element is visible and can be focused
                element.scrollIntoView({ behavior: 'instant', block: 'center' });
                await this.wait(100);

                // Focus first
                element.focus();

                // Dispatch pointer events for modern frameworks
                const pointerEvents = ['pointerdown', 'pointerup'];
                for (const type of pointerEvents) {
                    element.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        isPrimary: true,
                        button: 0
                    }));
                }

                // Dispatch mousedown/mouseup
                const mouseEvents = ['mousedown', 'mouseup'];
                for (const type of mouseEvents) {
                    element.dispatchEvent(new MouseEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        buttons: 1
                    }));
                }

                // Final native click
                element.click();

                return true;
            } catch (e) {
                console.warn('[Browser Harassment] Click failed, retrying...', e);
                await this.wait(200);
            }
        }

        return false;
    },

    /**
     * Wait for element to appear
     */
    async waitForElement(container, findFn, timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const element = findFn(container);
            if (element && BH_Detector.isVisible(element)) {
                return element;
            }
            await this.wait(100);
        }
        return null;
    },

    /**
     * Main automation entry point
     */
    async handlePopup(container) {
        console.log('[Browser Harassment] Handling popup...', container);

        // Special handling for Ethyca / Fides.js
        if (container.id?.startsWith('fides-') || container.classList?.contains('fides-overlay') || container.querySelector('.fides-banner, .fides-modal')) {
            console.log('[Browser Harassment] Detected Fides.js popup');

            // 1. Try direct "Opt out of all" if available on the banner
            const fidesReject = await this.waitForElement(container, (c) =>
                BH_Detector.findElement(c, '[data-testid="Opt out of all-btn"], [data-testid="Reject all-btn"], #fides-reject-all-button'), 1000);
            if (fidesReject) {
                console.log('[Browser Harassment] Found Fides reject button');
                await this.click(fidesReject);
                await this.wait(500);
                return { success: true, method: 'fides-direct-reject' };
            }

            // 2. Try "Your Privacy Choices" / Manage Preferences
            const fidesManage = await this.waitForElement(container, (c) =>
                BH_Detector.findElement(c, '#fides-manage-preferences-button, [data-testid="Manage preferences-btn"]'), 1000);
            if (fidesManage) {
                console.log('[Browser Harassment] Found Fides manage button, clicking...');
                await this.click(fidesManage);

                // Wait for the modal specifically
                const fidesModal = await this.waitForElement(document, (d) =>
                    BH_Detector.findElement(d, '#fides-modal, .fides-modal, #fides-consent-modal'), 5000);
                const searchRoot = fidesModal || document;

                // Look for Reject All in the modal
                const modalReject = await this.waitForElement(searchRoot, (r) =>
                    BH_Detector.findElement(r, '#fides-reject-all-button, [data-testid="Reject all-btn"]'), 3000);
                if (modalReject) {
                    console.log('[Browser Harassment] Found Reject All in Fides modal, waiting before click...');
                    await this.wait(300);
                    await this.click(modalReject);
                    console.log('[Browser Harassment] Clicked Reject All, waiting for state update...');
                    await this.wait(1500);
                }

                // Check again for save button in the modal
                const modalSave = await this.waitForElement(searchRoot, (r) =>
                    BH_Detector.findElement(r, '#fides-save-button, [data-testid="Save-btn"]'), 2000);
                if (modalSave) {
                    console.log('[Browser Harassment] Clicking Save in Fides modal');
                    await this.click(modalSave);
                    await this.wait(800);
                }

                return { success: true, method: 'fides-modal-complete' };
            }

            // Return success even if we just detected it and couldn't find buttons, to prevent fall-through
            return { success: true, method: 'fides-detected-only' };
        }

        // Special handling for WPConsent
        if (container.classList?.contains('wpconsent-banner') || container.id === 'wpconsent-banner' || container.querySelector('.wpconsent-banner-body') || container.className?.includes?.('wpconsent-')) {
            console.log('[Browser Harassment] Detected WPConsent related element');
            // Try inside container first
            let wpReject = await this.waitForElement(container, (c) =>
                BH_Detector.findElement(c, '#wpconsent-cancel-all, .wpconsent-cancel-all'), 2000);

            // Fallback: Try document level search (in case container is a sub-element)
            if (!wpReject) {
                console.log('[Browser Harassment] WPConsent button not in container, trying document search...');
                wpReject = await this.waitForElement(document, (d) =>
                    BH_Detector.findElement(d, '#wpconsent-cancel-all, .wpconsent-cancel-all'), 3000);
            }

            if (wpReject) {
                console.log('[Browser Harassment] Found WPConsent reject button, clicking...');
                await this.click(wpReject);
                await this.wait(500);
                return { success: true, method: 'wpconsent-rejected' };
            }
        }

        // Strategy 1: Try direct reject button
        const rejectBtn = BH_Detector.findRejectButton(container);
        if (rejectBtn) {
            console.log('[Browser Harassment] Found reject button, clicking...');
            await this.click(rejectBtn);
            await this.wait(this.actionDelay);

            // Check if popup is gone
            if (!BH_Detector.isVisible(container)) {
                console.log('[Browser Harassment] Popup dismissed via reject button');
                return { success: true, method: 'direct-reject' };
            }
        }

        // Strategy 2: Navigate to more options and reject there
        const moreOptionsBtn = BH_Detector.findMoreOptionsButton(container);
        if (moreOptionsBtn) {
            console.log('[Browser Harassment] Found more options button, navigating...');
            await this.click(moreOptionsBtn);
            await this.wait(500); // Wait for options panel to appear

            // Try to find reject all in the options panel
            const result = await this.handleOptionsPanel(container);
            if (result.success) {
                return result;
            }
        }

        // Strategy 3: Try to toggle everything off directly
        const toggleResult = await this.toggleAllOff(container);
        if (toggleResult.toggled > 0) {
            // Save the settings
            const saveBtn = BH_Detector.findSaveButton(container);
            if (saveBtn) {
                console.log('[Browser Harassment] Clicking save button...');
                await this.click(saveBtn);
                await this.wait(this.actionDelay);

                if (!BH_Detector.isVisible(container)) {
                    return { success: true, method: 'toggle-and-save', toggled: toggleResult.toggled };
                }
            }
        }

        // Popup still visible, return failure
        return { success: false, method: 'none' };
    },

    /**
     * Handle the options/preferences panel
     */
    async handleOptionsPanel(container) {
        console.log('[Browser Harassment] Handling options panel...');

        // First, check for reject all in the panel
        const rejectBtn = BH_Detector.findRejectButton(container);
        if (rejectBtn) {
            await this.click(rejectBtn);
            await this.wait(this.actionDelay);

            if (!BH_Detector.isVisible(container)) {
                return { success: true, method: 'options-reject' };
            }
        }

        // Handle tabs if present (IAB TCF style)
        const tabs = BH_Detector.findTabs(container);
        const tabKeys = ['purposes', 'features', 'partners', 'legitimateInterest'];

        for (const key of tabKeys) {
            const tab = tabs[key];
            if (tab && BH_Detector.isVisible(tab)) {
                console.log(`[Browser Harassment] Processing ${key} tab...`);
                await this.click(tab);
                await this.wait(300);

                // Look for reject all in this tab
                const tabRejectBtn = BH_Detector.findRejectButton(container);
                if (tabRejectBtn) {
                    await this.click(tabRejectBtn);
                    await this.wait(this.actionDelay);
                } else {
                    // Toggle all off in this tab
                    await this.toggleAllOff(container);
                }
            }
        }

        // Save and exit
        const saveBtn = BH_Detector.findSaveButton(container);
        if (saveBtn) {
            console.log('[Browser Harassment] Clicking save button...');
            await this.click(saveBtn);
            await this.wait(this.actionDelay);

            if (!BH_Detector.isVisible(container)) {
                return { success: true, method: 'tabs-and-save' };
            }
        }

        return { success: false, method: 'options-failed' };
    },

    /**
     * Toggle all consent switches to off
     */
    async toggleAllOff(container) {
        const toggles = BH_Detector.findToggles(container);
        let toggled = 0;

        console.log(`[Browser Harassment] Found ${toggles.length} toggles`);

        for (const toggle of toggles) {
            // Skip if already off
            if (!BH_Detector.isToggleEnabled(toggle)) {
                continue;
            }

            // Check if this is an On/Off button pair
            const offButton = BH_Detector.getOffButton(toggle);
            if (offButton && offButton !== toggle) {
                await this.click(offButton);
                toggled++;
            } else if (toggle.type === 'checkbox') {
                // Uncheck checkbox
                if (toggle.checked) {
                    toggle.checked = false;
                    toggle.dispatchEvent(new Event('change', { bubbles: true }));
                    toggled++;
                }
            } else {
                // Click to toggle
                await this.click(toggle);
                toggled++;
            }

            await this.wait(50);
        }

        console.log(`[Browser Harassment] Toggled ${toggled} switches off`);
        return { toggled };
    },

    /**
     * Check if popup is blocking page content
     */
    isBlockingOverlay(container) {
        const style = window.getComputedStyle(container);

        // Check if it's fixed/absolute positioned
        const isPositioned = style.position === 'fixed' || style.position === 'absolute';

        // Check if it covers significant viewport area
        const rect = container.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const coverageX = rect.width / viewportWidth;
        const coverageY = rect.height / viewportHeight;

        // Check for backdrop/overlay
        const hasBackdrop = style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
            parseFloat(style.opacity) > 0.3;

        return isPositioned && (coverageX > 0.5 || coverageY > 0.5 || hasBackdrop);
    },

    /**
     * Check if only accept button is available (no reject option)
     */
    hasOnlyAcceptOption(container) {
        const rejectBtn = BH_Detector.findRejectButton(container);
        const moreOptionsBtn = BH_Detector.findMoreOptionsButton(container);

        if (rejectBtn || moreOptionsBtn) {
            return false;
        }

        // Check for accept-only buttons
        const acceptPatterns = [
            /^(agree|accept|ok|got it|i understand|continue)$/i,
            /^accept(\s+all)?(\s+cookies)?$/i
        ];

        const clickables = BH_Detector.findClickableElements(container);
        for (const el of clickables) {
            const text = (el.textContent || el.value || '').trim();
            if (acceptPatterns.some(p => p.test(text))) {
                return true;
            }
        }

        return false;
    }
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.BH_Automator = BH_Automator;
}
