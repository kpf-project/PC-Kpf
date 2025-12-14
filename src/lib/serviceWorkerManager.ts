/**
 * Service Worker Manager
 * Handles PWA service worker registration and update detection
 */

export type UpdateCallback = (version: string, releaseNotes: unknown) => void;

class ServiceWorkerManager {
  private updateCallback: UpdateCallback | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize service worker and set up update detection
   */
  async initialize(onUpdate: UpdateCallback): Promise<void> {
    console.log('[SW] 🚀 Initializing Service Worker Manager...');

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('[SW] ❌ Service Worker not supported');
      return;
    }

    this.updateCallback = onUpdate;
    console.log('[SW] ✅ Update callback registered');

    try {
      // Wait for service worker to be ready
      this.registration = await navigator.serviceWorker.ready;
      console.log('[SW] Service Worker ready');

      // Set up update detection
      this.setupUpdateDetection();

      // Check for updates periodically (every 60 seconds)
      this.startUpdateChecks();

      // Check for updates when page becomes visible
      this.setupVisibilityListener();
    } catch (error) {
      console.error('[SW] Initialization failed:', error);
    }
  }

  /**
   * Set up service worker update detection
   */
  private setupUpdateDetection(): void {
    if (!this.registration) return;

    // Listen for new service worker installing
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (!newWorker) return;

      console.log('[SW] New service worker found, installing...');

      newWorker.addEventListener('statechange', async () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          console.log('[SW] New version available!');
          await this.notifyUpdate();
        }
      });
    });
  }

  /**
   * Start periodic update checks
   */
  private startUpdateChecks(): void {
    // Clear existing interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Check for updates every 60 seconds
    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, 60 * 1000);
  }

  /**
   * Listen for page visibility changes
   */
  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[SW] Page visible, checking for updates...');
        this.checkForUpdates();
      }
    });
  }

  /**
   * Manually check for service worker updates
   */
  async checkForUpdates(): Promise<void> {
    if (!this.registration) return;

    try {
      await this.registration.update();
    } catch (error) {
      console.error('[SW] Update check failed:', error);
    }
  }

  /**
   * Fetch version info and notify callback
   */
  private async notifyUpdate(): Promise<void> {
    console.log('[SW] 🔍 Checking for version update...');

    try {
      const response = await fetch('/version.json', {
        cache: 'no-cache',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch version info');
      }

      const versionInfo = await response.json();
      const currentVersion = this.getCurrentVersion();

      console.log('[SW] 📦 Version comparison:', {
        local: currentVersion,
        server: versionInfo.version,
        changed: versionInfo.version !== currentVersion,
      });

      // Only notify if version has changed
      if (versionInfo.version !== currentVersion) {
        console.log(
          `[SW] ✨ Version update detected: ${currentVersion} -> ${versionInfo.version}`
        );

        // Store new version
        this.setCurrentVersion(versionInfo.version);

        // Notify callback
        if (this.updateCallback) {
          console.log('[SW] 🔔 Triggering update popup...');
          this.updateCallback(versionInfo.version, versionInfo.releaseNotes);
        } else {
          console.warn('[SW] ⚠️ No update callback registered!');
        }
      } else {
        console.log('[SW] ✅ Already on latest version');
      }
    } catch (error) {
      console.error('[SW] ❌ Failed to notify update:', error);
    }
  }

  /**
   * Get current version from localStorage
   */
  private getCurrentVersion(): string {
    if (typeof window === 'undefined') return '0.0.0';
    return localStorage.getItem('app_version') || '0.0.0';
  }

  /**
   * Store version in localStorage
   */
  private setCurrentVersion(version: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('app_version', version);
    localStorage.setItem('app_version_updated_at', new Date().toISOString());
  }

  /**
   * Apply the update by reloading the page
   */
  applyUpdate(): void {
    console.log('[SW] Applying update...');

    if (this.registration && this.registration.waiting) {
      // Tell the waiting service worker to skip waiting
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Reload the page to activate new service worker
    window.location.reload();
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();
