import { createAuthClient } from "better-auth/react";
import { siweClient } from "better-auth/client/plugins";
import { adminClient } from "better-auth/client/plugins";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [siweClient(), adminClient(), usernameClient()],
});


