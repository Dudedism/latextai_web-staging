/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string;
  readonly VITE_RECAPTCHA_SITE_KEY: string;
}

declare global {
  interface Window {
    gtag: (command: string, action: string, params?: Record<string, unknown>) => void;
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            ux_mode?: string;
            login_uri?: string;
            callback?: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              type?: string;
              size?: string;
              theme?: string;
              text?: string;
              shape?: string;
              logo_alignment?: string;
              locale?: string;
              width?: number;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      render: (container: string | HTMLElement, options: Record<string, unknown>) => number;
    };
  }
}

export {};
