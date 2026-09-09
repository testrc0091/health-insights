import { HashRouter, Route, Routes } from "react-router-dom";
import { AppProviders } from "./app/AppProviders";
import { BottomNav } from "./ui/navigation/BottomNav";
import { TodayScreen } from "./ui/screens/TodayScreen";
import { NutritionScreen } from "./ui/screens/NutritionScreen";
import { InboxScreen } from "./ui/screens/InboxScreen";
import { BodyMeasurementsScreen } from "./ui/screens/BodyMeasurementsScreen";
import { TrainingScreen } from "./ui/screens/TrainingScreen";
import { CycleScreen } from "./ui/screens/CycleScreen";
import { SymptomsScreen } from "./ui/screens/SymptomsScreen";
import { ReturnToRunScreen } from "./ui/screens/ReturnToRunScreen";
import { TrendsScreen } from "./ui/screens/TrendsScreen";
import { SkinScreen } from "./ui/screens/SkinScreen";
import { SettingsScreen } from "./ui/screens/SettingsScreen";

/**
 * HashRouter (not BrowserRouter) deliberately — GitHub Pages serves a static project
 * site with no server-side rewrite rule to send deep links back to index.html, and a
 * hash route never hits the server on navigation, so it works with zero Pages config
 * and survives a Home Screen relaunch or manual refresh on any tab.
 */
export function App() {
  return (
    <AppProviders>
      <HashRouter>
        <div className="mx-auto min-h-screen max-w-md pb-24">
          <main className="px-4 pt-6">
            <Routes>
              <Route path="/" element={<TodayScreen />} />
              <Route path="/nutrition" element={<NutritionScreen />} />
              <Route path="/inbox" element={<InboxScreen />} />
              <Route path="/body-measurements" element={<BodyMeasurementsScreen />} />
              <Route path="/training" element={<TrainingScreen />} />
              <Route path="/cycle" element={<CycleScreen />} />
              <Route path="/symptoms" element={<SymptomsScreen />} />
              <Route path="/return-to-run" element={<ReturnToRunScreen />} />
              <Route path="/trends" element={<TrendsScreen />} />
              <Route path="/skin" element={<SkinScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
            </Routes>
          </main>
        </div>
        <BottomNav />
      </HashRouter>
    </AppProviders>
  );
}
