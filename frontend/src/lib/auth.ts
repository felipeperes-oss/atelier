import { api, type AppUser } from "@/lib/api";

const USER_KEY = "atelier-user";
const AUTH_EVENT = "atelier-auth-changed";

export function getStoredUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(USER_KEY);
  return value ? (JSON.parse(value) as AppUser) : null;
}

export function setStoredUser(user: AppUser | null) {
  if (typeof window === "undefined") return;
  if (user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(USER_KEY);
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function onAuthChange(callback: () => void) {
  window.addEventListener(AUTH_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(AUTH_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export async function signIn(email: string, password: string) {
  const { user } = await api.auth.signIn(email, password);
  setStoredUser(user);
  return user;
}

export async function signUp(email: string, password: string, displayName: string) {
  const { user } = await api.auth.signUp(email, password, displayName);
  setStoredUser(user);
  return user;
}

export function signOut() {
  setStoredUser(null);
}
