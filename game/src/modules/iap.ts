import { Platform } from "react-native";
import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  restorePurchases,
  type Purchase,
} from "./expo-iap-ios";
import monetization from "../../monetization.json";
import { store } from "./store";
import { analytics } from "./analytics";

/**
 * Google Play Billing / StoreKit via expo-iap. Products are defined in
 * monetization.json and created in Play Console and App Store Connect by the
 * factory's publisher (same SKUs).
 */
type Sku = { sku: string; consumable: boolean; coins?: number };
const catalog: Sku[] = monetization.iap;
const bySku = new Map(catalog.map((p) => [p.sku, p]));

export interface ShopItem {
  sku: string;
  title: string;
  price: string;
}

let connected = false;
let items: ShopItem[] = [];

async function loadProducts(): Promise<void> {
  const products = (await fetchProducts({ skus: catalog.map((p) => p.sku), type: "in-app" })) ?? [];
  items = products.map((p) => ({
    sku: p.id,
    title: p.title,
    price: p.displayPrice,
  }));
}

function grant(p: Purchase): void {
  const def = bySku.get(p.productId);
  if (!def) return;
  if (p.productId === "remove_ads") store.set({ adsRemoved: true });
  if (def.coins) store.set({ coins: store.get().coins + def.coins });
  analytics.track("iap_purchase", { sku: p.productId });
}

export const iap = {
  async init(): Promise<void> {
    try {
      connected = await initConnection();
      if (!connected) return;
      purchaseUpdatedListener(async (p) => {
        grant(p);
        const def = bySku.get(p.productId);
        await finishTransaction({ purchase: p, isConsumable: !!def?.consumable }).catch(() => {});
      });
      purchaseErrorListener((e) => {
        if (__DEV__) console.warn("[iap] purchase error", e);
      });
      await loadProducts();
      await iap.restore();
    } catch (e) {
      if (__DEV__) console.warn("[iap] init failed", e);
    }
  },

  items(): ShopItem[] {
    return items;
  },

  /** iOS: retry the StoreKit product fetch (e.g. the shop opened before it answered or offline at boot). */
  async refresh(): Promise<ShopItem[]> {
    if (Platform.OS === "ios" && connected && !items.length) await loadProducts().catch(() => {});
    return items;
  },

  /** Opens the store's purchase sheet; false when the store isn't reachable (the shop tells the player). */
  async purchase(sku: string): Promise<boolean> {
    if (!connected || !bySku.has(sku)) return false;
    if (Platform.OS === "ios") {
      await requestPurchase({ request: { apple: { sku }, google: { skus: [sku] } }, type: "in-app" }).catch(() => {});
      return true;
    }
    return requestPurchase({ request: { google: { skus: [sku] } }, type: "in-app" }).then(() => true, () => false);
  },

  /** Re-grant non-consumables (remove_ads) on reinstall / new device. */
  /** Returns whether Remove Ads is owned after the check, or null when the store isn't reachable. */
  async restore(userInitiated = false): Promise<boolean | null> {
    if (!connected) return null;
    // iOS "Restore purchases" button: sync with the App Store first (StoreKit
    // may ask for the Apple ID) so purchases from another device show up.
    if (Platform.OS === "ios" && userInitiated) await restorePurchases().catch(() => {});
    const owned = await getAvailablePurchases().catch(() => null);
    if (owned == null) return null;
    for (const p of owned) {
      if (p.productId === "remove_ads") store.set({ adsRemoved: true });
    }
    return store.get().adsRemoved;
  },
};
