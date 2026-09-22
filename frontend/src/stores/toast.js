import { defineStore } from "pinia";

let uid = 0;

export const useToastStore = defineStore("toast", {
  state: () => ({ items: [] }),
  actions: {
    push(text, type = "info") {
      const id = ++uid;
      this.items.push({ id, text, type });
      setTimeout(() => this.dismiss(id), 5000);
    },
    dismiss(id) {
      this.items = this.items.filter((t) => t.id !== id);
    },
    success(text) {
      this.push(text, "success");
    },
    error(text) {
      this.push(text, "error");
    },
    info(text) {
      this.push(text, "info");
    },
  },
});
