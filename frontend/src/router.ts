import { createRouter, createWebHistory } from "vue-router";
import SummaryListView from "./views/SummaryListView.vue";
import SummaryNewView from "./views/SummaryNewView.vue";
import SummaryEditView from "./views/SummaryEditView.vue";
import SummaryDetailView from "./views/SummaryDetailView.vue";
import SummaryGenerateView from "./views/SummaryGenerateView.vue";
import FoodListView from "./views/FoodListView.vue";
import FoodNewView from "./views/FoodNewView.vue";
import FoodEditView from "./views/FoodEditView.vue";
import FoodDetailView from "./views/FoodDetailView.vue";
import FoodGenerateView from "./views/FoodGenerateView.vue";

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

    // Food reviews — same shape as summaries, backed by its own table.
    { path: "/food", name: "food-list", component: FoodListView },
    { path: "/food/new", name: "food-new", component: FoodNewView },
    {
      path: "/food/:id",
      name: "food-detail",
      component: FoodDetailView,
      props: true,
    },
    {
      path: "/food/:id/edit",
      name: "food-edit",
      component: FoodEditView,
      props: true,
    },
    {
      path: "/food/:id/generate",
      name: "food-generate",
      component: FoodGenerateView,
      props: true,
    },

    { path: "/:pathMatch(.*)*", redirect: { name: "list" } },
  ],
});
