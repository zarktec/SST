"use client";
import { magicLinkClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Cliente de auth. Sin baseURL: usa el origen actual (cada empresa tiene el suyo). */
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), twoFactorClient({ twoFactorPage: "/login/2fa" })],
});
