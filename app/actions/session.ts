"use server";

import { getSessionUser } from "@/lib/auth/session";
import { getUserProfile } from "@/lib/repositories/users";
import type { SessionUser } from "@/lib/types";

export async function getCurrentUserAction(): Promise<
  (SessionUser & { name: string }) | null
> {
  const session = await getSessionUser();
  if (!session) return null;

  const profile = await getUserProfile(session.uid);
  return { ...session, name: profile?.name ?? session.email };
}
