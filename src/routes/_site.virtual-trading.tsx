import { createFileRoute } from "@tanstack/react-router";
import VirtualTrading from "@/views/VirtualTrading";

export const Route = createFileRoute("/_site/virtual-trading")({
  head: () => ({
    meta: [
      { title: "Virtual Trading Platform — IndiFunded" },
      {
        name: "description",
        content:
          "Explore IndiFunded's virtual trading platform: dashboard, watchlist, orders, portfolio, rule-based evaluation and risk monitoring.",
      },
      { property: "og:title", content: "Virtual Trading Platform — IndiFunded" },
      {
        property: "og:description",
        content:
          "Explore IndiFunded's virtual trading platform: dashboard, watchlist, orders, portfolio, rule-based evaluation and risk monitoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VirtualTrading,
});
