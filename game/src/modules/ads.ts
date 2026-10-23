import mobileAds, {
  AdEventType,
  AdsConsent,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
} from "react-native-google-mobile-ads";
import { Platform } from "react-native";
import monetization from "../../monetization.json";
import monetizationIos from "../../monetization.ios.json";
import { store } from "./store";
import { analytics } from "./analytics";

/**
 * Production ad layer (AdMob). Policy-safe defaults the QA gate checks for:
 * - UMP consent gathered before any ad request (GDPR / US state privacy)
 * - interstitials only at natural breaks, frequency-capped, never on first session start
 * - rewarded ads are always opt-in
 * - the remove_ads purchase disables interstitials + banners
 */
const MIN_SECONDS_BETWEEN_INTERSTITIALS = 90;
// Pacing from competitor review research: forced ads after every level are the #1 cause of 1★ reviews.
const MIN_LEVELS_BETWEEN_INTERSTITIALS = 4;
const FIRST_INTERSTITIAL_LEVEL = 10;
const NO_BANNER_UNTIL_LEVEL = 5;

// iOS serves from its own AdMob app (never the Android unit ids). There is no
// App Tracking Transparency prompt, so the IDFA is never available to the SDK.
const ids = Platform.OS === "ios" ? monetizationIos.admob : monetization.admob;
let ready = false;
let lastInterstitialAt = Date.now() / 1000; // grace period after launch
let levelsSinceInterstitial = 0;

const interstitial = InterstitialAd.createForAdRequest(ids.interstitial);
const rewarded = RewardedAd.createForAdRequest(ids.rewarded);
let interstitialLoaded = false;
let rewardedLoaded = false;

interstitial.addAdEventListener(AdEventType.LOADED, () => (interstitialLoaded = true));
interstitial.addAdEventListener(AdEventType.CLOSED, () => {
  interstitialLoaded = false;
  interstitial.load();
});
interstitial.addAdEventListener(AdEventType.ERROR, () => (interstitialLoaded = false));
rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => (rewardedLoaded = true));
rewarded.addAdEventListener(AdEventType.CLOSED, () => {
  rewardedLoaded = false;
  rewarded.load();
});
rewarded.addAdEventListener(AdEventType.ERROR, () => (rewardedLoaded = false));

export const ads = {
  bannerUnitId: ids.banner,

  /** Call once at boot, before showing any ad. */
  async init(): Promise<void> {
    try {
      await AdsConsent.gatherConsent();
      const { canRequestAds } = await AdsConsent.getConsentInfo();
      if (!canRequestAds) return;
      await mobileAds().initialize();
      ready = true;
      interstitial.load();
      rewarded.load();
    } catch (e) {
      if (__DEV__) console.warn("[ads] init failed", e);
    }
  },

  /** No banner during the first levels: new players judge the game in its first minutes. */
  canShowBanner(): boolean {
    return ready && !store.get().adsRemoved && store.get().level > NO_BANNER_UNTIL_LEVEL;
  },

  /** Call at a natural break (level end). Returns true if an ad was shown. */
  showInterstitial(): boolean {
    levelsSinceInterstitial++;
    if (!ready || store.get().adsRemoved || !interstitialLoaded) return false;
    if (store.get().level < FIRST_INTERSTITIAL_LEVEL) return false;
    const now = Date.now() / 1000;
    if (now - lastInterstitialAt < MIN_SECONDS_BETWEEN_INTERSTITIALS) return false;
    if (levelsSinceInterstitial < MIN_LEVELS_BETWEEN_INTERSTITIALS) return false;
    lastInterstitialAt = now;
    levelsSinceInterstitial = 0;
    analytics.track("ad_interstitial_shown");
    interstitial.show().catch(() => {});
    return true;
  },

  rewardedAvailable(): boolean {
    return ready && rewardedLoaded;
  },

  /** Opt-in only: call from a button the player pressed. */
  showRewarded(onReward: () => void): boolean {
    if (!ready || !rewardedLoaded) return false;
    // Register listeners per presentation and ALWAYS tear them down — on earn,
    // on close (player dismissed without earning) and on error. Without the
    // close/error cleanup the EARNED_REWARD listener (and its retained onReward
    // closure) leaked on every dismissed ad, growing memory over a session.
    const subs: Array<() => void> = [];
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      for (const u of subs) u();
    };
    subs.push(
      rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        analytics.track("ad_rewarded_earned");
        onReward();
        cleanup();
      }),
    );
    subs.push(rewarded.addAdEventListener(AdEventType.CLOSED, cleanup));
    subs.push(rewarded.addAdEventListener(AdEventType.ERROR, cleanup));
    rewarded.show().catch(cleanup);
    return true;
  },
};
