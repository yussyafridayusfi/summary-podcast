import { createRouter, createWebHistory } from "vue-router";
import SummaryListView from "./views/SummaryListView.vue";
import SummaryNewView from "./views/SummaryNewView.vue";
import SummaryEditView from "./views/SummaryEditView.vue";
import SummaryDetailView from "./views/SummaryDetailView.vue";
import SummaryGenerateView from "./views/SummaryGenerateView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "list", component: SummaryListView },
    { path: "/new", name: "new", component: SummaryNewView },
    {
      path: "/summaries/:id",
      name: "detail",
      component: SummaryDetailView,
      props: true,
    },
    {
      path: "/summaries/:id/edit",
      name: "edit",
      component: SummaryEditView,
      props: true,
    },
    {
      path: "/summaries/:id/generate",
      name: "generate",
      component: SummaryGenerateView,
      props: true,
    },
    { path: "/:pathMatch(.*)*", redirect: { name: "list" } },
  ],
});
