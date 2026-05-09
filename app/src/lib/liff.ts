import liff from '@line/liff';

const LIFF_ID = import.meta.env.VITE_LIFF_ID as string;

let initialized = false;

export async function initLiff(): Promise<void> {
  if (initialized) return;
  await liff.init({ liffId: LIFF_ID });
  initialized = true;
}

export async function ensureLoggedIn(): Promise<void> {
  await initLiff();
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    await new Promise(() => {}); // intentionally never resolves (redirect happens)
  }
}

export async function getAccessToken(): Promise<string> {
  await ensureLoggedIn();
  return liff.getAccessToken()!;
}

export async function getLineProfile() {
  await ensureLoggedIn();
  return liff.getProfile();
}
