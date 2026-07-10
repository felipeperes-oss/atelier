import { useEffect, useState } from "react";
import { getStoredUser, onAuthChange } from "@/lib/auth";
import type { AppUser } from "@/lib/api";

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refresh = () => {
      setUser(getStoredUser());
      setLoading(false);
    };
    refresh();
    return onAuthChange(refresh);
  }, []);

  return { session: user ? { user } : null, user, loading };
}
