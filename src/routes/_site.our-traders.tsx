import { createFileRoute } from "@tanstack/react-router";
import OurTraders from "@/components/OurTraders";
import ClientReviews from "@/components/ClientReviews";

export const Route = createFileRoute("/_site/our-traders")({
  head: () => ({
    meta: [
      { title: "Our Traders — Video Stories | IndiFunded" },
      {
        name: "description",
        content: "Watch IndiFunded traders share their journey, trading style and rewards earned.",
      },
      { property: "og:title", content: "Our Traders — Video Stories | IndiFunded" },
      {
        property: "og:description",
        content: "Watch IndiFunded traders share their journey, trading style and rewards earned.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OurTradersPage,
});

function OurTradersPage() {
  return (
    <div className="pt-10">
      <OurTraders
        showEmpty
        heading="Meet our traders"
        subtitle="Real IndiFunded traders on their journey — tap any card to watch."
      />
      <ClientReviews quotesOnly />
    </div>
  );
}
