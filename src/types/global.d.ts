export interface DevSeedGlobal {
  seed: () => Promise<void>;
}

declare global {
  interface Window {
    __DEV_SEED__?: DevSeedGlobal;
  }
}
