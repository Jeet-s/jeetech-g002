import { useEffect, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, { FadeIn, FadeOut, ZoomInEasyDown } from "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { HomeScreen } from "./screens/HomeScreen";
import { LevelsScreen } from "./screens/LevelsScreen";
import { GameScreen } from "./screens/GameScreen";
import { ShopScreen } from "./screens/ShopScreen";
import { SettingsPopup, initAudio } from "./ui";
import { analytics } from "./modules/analytics";
import { layout } from "./modules/layout";
import { ads } from "./modules/ads";
import { iap } from "./modules/iap";
import { store } from "./modules/store";
import { ScreenshotScene } from "./screenshots";

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Root of the premium runtime. Boot order matters: fonts → player state →
 * audio → consent + ads → billing. The builder adds screens/flows but keeps
 * this shell: providers, fonts, the banner slot and screenshot mode.
 */
export default function App() {
  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  // Screenshot mode (<scheme>://shot/<id>): render a store-screenshot scene
  // without ads or billing. undefined = still checking the launch URL.
  const [shot, setShot] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    Linking.getInitialURL()
      .then((u) => setShot(u?.match(/shot\/([\w-]+)/)?.[1] ?? null))
      .catch(() => setShot(null));
  }, []);
  const ready = fontsLoaded && shot !== undefined;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return <View style={styles.root} />;
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {shot ? <ScreenshotScene id={shot} /> : <Game />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Game() {
  const [booted, setBooted] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [screen, setScreen] = useState<{ name: "home" } | { name: "levels" } | { name: "game"; level: number }>({ name: "home" });
  const [shopOpen, setShopOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    (async () => {
      await store.load();
      analytics.track("app_open");
      setBooted(true);
      await initAudio();
      await ads.init();
      setShowBanner(ads.canShowBanner());
      await iap.init();
    })();
    return store.subscribe(() => setShowBanner(ads.canShowBanner()));
  }, []);
  useEffect(() => {
    if (!showBanner) layout.setBannerHeight(0);
  }, [showBanner]);

  if (!booted) return <View style={styles.root} />;
  return (
    <View style={styles.root}>
      <Animated.View
        key={screen.name === "game" ? `game-${screen.level}` : screen.name}
        // Into a level: the board rises and grows into place; back to the map: a soft fade.
        entering={screen.name === "game" ? ZoomInEasyDown.duration(340) : FadeIn.duration(280)}
        exiting={FadeOut.duration(160)}
        style={styles.root}
      >
        {screen.name === "home" ? (
          <HomeScreen
            onPlay={(level) => setScreen({ name: "game", level })}
            onLevels={() => setScreen({ name: "levels" })}
            onShop={() => setShopOpen(true)}
            onSettings={() => setSettingsOpen(true)}
          />
        ) : screen.name === "levels" ? (
          <LevelsScreen onPlay={(level) => setScreen({ name: "game", level })} onBack={() => setScreen({ name: "home" })} />
        ) : (
          <GameScreen
            key={screen.level}
            levelNumber={screen.level}
            onExit={() => setScreen({ name: "levels" })}
            onSettings={() => setSettingsOpen(true)}
            onNextLevel={(level) => setScreen({ name: "game", level })}
          />
        )}
      </Animated.View>
      <ShopScreen visible={shopOpen} onClose={() => setShopOpen(false)} />
      <SettingsPopup visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {showBanner && (
        <View style={styles.banner} onLayout={(e) => layout.setBannerHeight(e.nativeEvent.layout.height)}>
          <BannerAd unitId={ads.bannerUnitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0F151C" },
  banner: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" },
});
