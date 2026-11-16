import { createFileRoute } from "@tanstack/react-router";
import { RiskManagement } from "@/views/app/TraderScreens";

export const Route = createFileRoute("/app/risk")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Risk Management — IndiFunded" },
      { name: "description", content: "IndiFunded trader dashboard: risk management." },
      { property: "og:title", content: "Risk Management — IndiFunded" },
      { property: "og:description", content: "IndiFunded trader dashboard: risk management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RiskManagement,
});
