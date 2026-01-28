/// <reference types="vite/client" />

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
  }
}

export {};
