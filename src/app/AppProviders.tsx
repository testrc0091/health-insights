import { createContext, useContext, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getUserProfileOrDefault, userProfileRepository } from "../storage/repositories";
import { DEFAULT_USER_PROFILE, type UserProfile } from "../storage/schemas/userProfile";

interface AppContextValue {
  userProfile: UserProfile;
  saveUserProfile: (profile: UserProfile) => Promise<void>;
  /** True until the first-run seed check has resolved — screens that read from the
   * database should wait for this before treating an empty result as "no data yet"
   * (it might just be seeding). */
  isReady: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

/**
 * Composition root: wires Dexie + repositories into React via a live-query-backed
 * profile (re-renders automatically on any write, ARCHITECTURE.md §5 "app: composition
 * root"), and runs the one-time demo-data seed before rendering children so every
 * screen has something real to show on first load.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [isReady] = useState(true);

  const liveProfile = useLiveQuery(() => getUserProfileOrDefault(), []);

  const saveUserProfile = async (profile: UserProfile) => {
    await userProfileRepository.put(profile);
  };

  return (
    <AppContext.Provider value={{ userProfile: liveProfile ?? DEFAULT_USER_PROFILE, saveUserProfile, isReady }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProviders");
  return ctx;
}
