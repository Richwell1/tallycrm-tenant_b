import { createFileRoute } from "@tanstack/react-router";
import { MarketplacePage } from "@/components/marketplace/MarketplacePage";

export const Route = createFileRoute("/_authenticated/app/marketplace/")({
  component: MarketplacePage,
});
