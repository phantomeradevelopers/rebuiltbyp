/**
 * Client helper for Apple In-App Purchase via RevenueCat.
 * Only active inside the native iOS app; the plugin is imported lazily so
 * the web bundle never loads it.
 */
import { isNative, nativePlatform } from "@/lib/health-sync";
import { getRevenueCatConfig, syncAppleEntitlement } from "@/lib/iap.functions";
import type { Plan } from "@/lib/tier";

export const IAP_PRODUCT: Partial<Record<Plan, string>> = {
  pro_monthly: "rebuilt.pro.monthly",
  pro_annual: "rebuilt.pro.yearly",
  elite_monthly: "rebuilt.elite.monthly",
  elite_annual: "rebuilt.elite.yearly",
};

export function isAppleIapContext(): boolean {
  return isNative() && nativePlatform() === "ios";
}

let configured = false;
async function plugin() {
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  if (!configured) {
    const cfg = await getRevenueCatConfig();
    if (!cfg.apiKey) throw new Error("In-app purchases are not available yet. Please try again later.");
    await Purchases.configure({ apiKey: cfg.apiKey, appUserID: cfg.appUserId });
    configured = true;
  }
  return Purchases;
}

export async function purchaseWithApple(plan: Plan): Promise<string> {
  const productId = IAP_PRODUCT[plan];
  if (!productId) throw new Error("This item isn't sold in the app.");
  const Purchases = await plugin();
  const { products } = await Purchases.getProducts({ productIdentifiers: [productId] });
  const product = products[0];
  if (!product) throw new Error("Product unavailable. Try again shortly.");
  await Purchases.purchaseStoreProduct({ product });
  const r = await syncAppleEntitlement();
  return r.tier;
}

export async function restoreApplePurchases(): Promise<string> {
  const Purchases = await plugin();
  await Purchases.restorePurchases();
  const r = await syncAppleEntitlement();
  return r.tier;
}
