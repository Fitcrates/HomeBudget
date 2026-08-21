import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import { query } from "./_generated/server";

// Credentials are read explicitly rather than relying on Auth.js env inference,
// so a missing variable is visible here instead of failing at the callback.
const googleClientId = process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;

// Google is only registered once both credentials exist. Deploying this file
// before the Cloud Console side is configured then leaves password sign-in
// working instead of breaking auth for everyone.
const oauthProviders = googleClientId && googleClientSecret
  ? [Google({ clientId: googleClientId, clientSecret: googleClientSecret })]
  : [];

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  // Account linking by verified e-mail is the library default for OAuth
  // providers, so signing in with Google lands on the existing password
  // account for the same address rather than creating a duplicate household.
  providers: [Password, ...oauthProviders],
});

/** Lets the client hide the Google button when the deployment has no credentials. */
export const authProviders = query({
  args: {},
  handler: async () => ({ google: oauthProviders.length > 0 }),
});

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get("users", userId);
    if (!user) {
      return null;
    }
    return user;
  },
});
