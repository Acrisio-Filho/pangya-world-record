// Cache de Courses/PowerBands (lidos várias vezes em várias páginas).
import { defineStore } from "pinia";
import { apiGet } from "../lib/api";

export const useLookupsStore = defineStore("lookups", {
  state: () => ({
    courses: [],
    bands: [],
    loaded: false,
  }),
  getters: {
    activeCourses: s => s.courses.filter(c => String(c.active).toUpperCase() === "TRUE"),
    activeBands: s => s.bands.filter(b => String(b.active).toUpperCase() === "TRUE"),
    cname: (s) => (id) => s.courses.find((c) => String(c.id) === String(id))?.name || id,
    bname: (s) => (id) => s.bands.find((b) => String(b.id) === String(id))?.label || id,
  },
  actions: {
    async load(includeInactive = false) {
      const params = includeInactive ? { include_inactive: "1" } : {};
      const [courses, bands] = await Promise.all([apiGet("listCourses", params), apiGet("listBands", params)]);
      if (!Array.isArray(courses) || !Array.isArray(bands)) throw new Error(courses?.erro || bands?.erro || "Não foi possível carregar as categorias.");
      this.courses = Array.isArray(courses) ? courses : [];
      this.bands = Array.isArray(bands) ? bands : [];
      this.loaded = true;
    },
    async ensure() {
      if (!this.loaded) await this.load();
    },
  },
});
