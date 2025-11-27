"use client";

import { createAuthClient } from "better-auth/react";
import { siweClient, adminClient, usernameClient } from "better-auth/client/plugins";

// Only create client in browser environment
export const authClient =
  typeof window !== "undefined"
    ? createAuthClient({
        plugins: [siweClient(), adminClient(), usernameClient()],
      })
    : null;
