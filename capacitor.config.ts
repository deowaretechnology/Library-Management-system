import type { CapacitorConfig } from "@capacitor/cli";

// This Android app does NOT bundle a copy of the Next.js site — it's a native
// WebView shell that loads the already-deployed live site below. Same MongoDB,
// same Sanity, same logins as the website. Change `url` here if the production
// domain ever changes (custom domain, new Vercel project, etc).
const LIVE_APP_URL = "https://library-management-system-six-pi-17.vercel.app";

const config: CapacitorConfig = {
  appId: "com.deoware.collegelibrary",
  appName: "College Library",
  webDir: "public",
  server: {
    url: LIVE_APP_URL,
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
