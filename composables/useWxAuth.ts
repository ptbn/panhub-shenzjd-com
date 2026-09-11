import { computed } from "vue";

export function useWxAuth() {
  return {
    isVerified: computed(() => true),
    isReady: computed(() => true),
    checkSearchAuth: async () => true,
    forceVerify: async () => true,
  };
}

export default useWxAuth;
