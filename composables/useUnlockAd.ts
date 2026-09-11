export function resolveFloatingUnlock(): Promise<any> {
  return Promise.resolve();
}

export function maybeShowUnlockAd(): void {
  // 纯净版：零广告、零弹窗
}

export function useUnlockAd() {
  return {
    maybeShowUnlockAd,
    resolveFloatingUnlock,
  };
}

export default useUnlockAd;
