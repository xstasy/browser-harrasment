// Browser Harassment - Fallback Handler
// Shows warning when consent cannot be automatically rejected

const BH_Fallback = {
    warningId: 'bh-warning-overlay',

    /**
     * Show warning overlay to user
     */
    showWarning(container) {
        // Don't show if already showing
        if (document.getElementById(this.warningId)) {
            return;
        }

        const hostname = window.location.hostname;

        const overlay = document.createElement('div');
        overlay.id = this.warningId;
        overlay.className = 'bh-warning-overlay';
        overlay.innerHTML = `
      <div class="bh-warning-content">
        <div class="bh-warning-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h2 class="bh-warning-title">Privacy Consent Required</h2>
        <p class="bh-warning-text">
          <strong>${hostname}</strong> requires consent to access the site. 
          Browser Harassment couldn't find a way to reject tracking automatically.
        </p>
        <p class="bh-warning-subtext">
          Continuing may allow third-party tracking and data collection.
        </p>
        <div class="bh-warning-actions">
          <button class="bh-btn bh-btn-secondary" id="bh-leave-site">
            Leave Site
          </button>
          <button class="bh-btn bh-btn-primary" id="bh-continue-anyway">
            Continue Anyway
          </button>
        </div>
        <div class="bh-warning-footer">
          <label class="bh-checkbox-label">
            <input type="checkbox" id="bh-whitelist-site">
            <span>Don't warn me again for this site</span>
          </label>
        </div>
      </div>
    `;

        document.body.appendChild(overlay);

        // Event handlers
        document.getElementById('bh-leave-site').addEventListener('click', () => {
            window.history.back();
            // Fallback if no history
            setTimeout(() => {
                window.location.href = 'about:blank';
            }, 100);
        });

        document.getElementById('bh-continue-anyway').addEventListener('click', async () => {
            const shouldWhitelist = document.getElementById('bh-whitelist-site').checked;

            if (shouldWhitelist) {
                // Add to whitelist
                await chrome.runtime.sendMessage({
                    type: 'ADD_TO_WHITELIST',
                    hostname: hostname
                });
            }

            // Remove warning
            this.hideWarning();

            // Try to find and click accept button
            if (container && BH_Detector.isVisible(container)) {
                const acceptPatterns = [
                    /^(agree|accept|ok|got it|i understand|continue)$/i,
                    /^accept(\s+all)?(\s+cookies)?$/i
                ];

                const clickables = BH_Detector.findClickableElements(container);
                for (const el of clickables) {
                    const text = (el.textContent || el.value || '').trim();
                    if (acceptPatterns.some(p => p.test(text))) {
                        el.click();
                        break;
                    }
                }
            }
        });

        // Report to background
        chrome.runtime.sendMessage({
            type: 'POPUP_FAILED',
            hostname: hostname
        });
    },

    /**
     * Hide warning overlay
     */
    hideWarning() {
        const overlay = document.getElementById(this.warningId);
        if (overlay) {
            overlay.remove();
        }
    },

    /**
     * Check if warning is currently shown
     */
    isWarningShown() {
        return !!document.getElementById(this.warningId);
    }
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.BH_Fallback = BH_Fallback;
}
