export interface AntigravityGlobal {
  seed: () => Promise<void>;
}

declare global {
  interface Window {
    antigravity?: AntigravityGlobal;
  }
}
