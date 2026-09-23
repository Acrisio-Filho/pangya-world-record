import { ref } from "vue";

export const navigationFailure = ref(null);

export function installNavigationRecovery(router) {
  router.onError((error, to) => {
    const target = to?.fullPath || "/";
    navigationFailure.value = { target, message: error.message };
    // An open tab may reference a lazy chunk removed by a subsequent build.
    // Retry at most once per minute; persistent/network failures show a retry view.
    if (!/dynamically imported module|module script|loading chunk|preload css/i.test(error.message)) return;
    try {
      const key = "pwr-navigation-recovery";
      const previous = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - previous < 60000) return;
      sessionStorage.setItem(key, String(Date.now()));
      reloadRoute(router, target);
    } catch { /* Storage unavailable: the explicit recovery button remains usable. */ }
  });
  router.afterEach((_to, _from, failure) => { if (!failure) navigationFailure.value = null; });
}

export function reloadRoute(router, target) {
  window.location.hash = router.resolve(target).href.split("#")[1] || "/";
  window.location.reload();
}
