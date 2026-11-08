import type { Metadata } from "next";
import { ShopScreen } from "@/components/shop-screen";
import { loadShop } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Shop",
};

export const instant = false;

export default async function ShopPage() {
  const shop = await loadShop();
  return <ShopScreen {...shop} />;
}
