export {};

declare global {
  interface Window {
    antigravity?: {
      seed: () => Promise<void>;
    };
  }
}
