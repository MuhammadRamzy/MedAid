"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUserAction } from "@/app/actions/session";
import type { SessionUser } from "@/lib/types";

type CurrentUser = (SessionUser & { name: string }) | null;

const CurrentUserContext = createContext<{ user: CurrentUser; loading: boolean }>({
  user: null,
  loading: true,
});

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUserAction()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  return (
    <CurrentUserContext.Provider value={{ user, loading }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
