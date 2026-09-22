import { defineStore } from "pinia";

export const useConfirmStore = defineStore("confirm", {
  state: () => ({ request: null, resolveRequest: null }),
  actions: {
    ask(options) {
      if (this.resolveRequest) this.resolveRequest(false);
      return new Promise((resolve) => {
        this.request = {
          title: "Confirmar ação",
          message: "Esta ação será aplicada.",
          confirmLabel: "Confirmar",
          tone: "primary",
          ...options,
        };
        this.resolveRequest = resolve;
      });
    },
    answer(accepted) {
      const resolve = this.resolveRequest;
      this.request = null;
      this.resolveRequest = null;
      if (resolve) resolve(accepted);
    },
  },
});
