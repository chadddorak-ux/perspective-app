// Stand-in for next/navigation in the static build.
import { navigate, refresh, useRoute } from "../router";

export class NotFoundError extends Error {}

export function notFound(): never {
  throw new NotFoundError("Not found");
}

export function useRouter() {
  return {
    push: (url: string) => navigate(url),
    replace: (url: string) => navigate(url, { replace: true }),
    refresh,
    back: () => window.history.back(),
    prefetch: () => {},
  };
}

export function usePathname(): string {
  return useRoute().path;
}
