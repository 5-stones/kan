import Head from "next/head";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { env } from "next-runtime-env";
import { useState } from "react";

import { authClient } from "@kan/auth/client";
import { CORAGGIO_APP_NAME } from "@kan/shared";

import { PageHead } from "~/components/PageHead";

// Same Adobe Fonts kit as themes/coraggio.yaml: the login page has no
// workspace, so the theme (and its font import) isn't injected here
const FONTS_URL = "https://use.typekit.net/xfa6ujr.css";

const inputClassName =
  "h-[3.75rem] w-full rounded-md border border-[#6f6c69] bg-[#322e29] px-7 text-xl text-white placeholder:text-white focus:border-[#eecd5c] focus:outline-none focus:ring-0";

/**
 * Login page from docs/designs/Login.png: email and a gold "sign in" pill that
 * emails a sign-in link; "login with password" reveals the password field.
 */
export default function LoginView() {
  const router = useRouter();
  const redirect = useSearchParams().get("next");
  const callbackURL = redirect ?? "/boards";
  const isSignUpDisabled = env("NEXT_PUBLIC_DISABLE_SIGN_UP") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordLogin, setIsPasswordLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [magicLinkRecipient, setMagicLinkRecipient] = useState<string | null>(
    null,
  );

  const { data } = authClient.useSession();
  if (data?.user.id) router.push(callbackURL);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    const recipient = email.trim();
    if (!recipient) return setError(t`Please enter your email address.`);
    if (isPasswordLogin && !password)
      return setError(t`Please enter your password.`);

    setIsPending(true);
    setError(null);
    if (isPasswordLogin) {
      await authClient.signIn.email(
        { email: recipient, password, callbackURL },
        { onError: ({ error }) => setError(error.message) },
      );
    } else {
      await authClient.signIn.magicLink(
        { email: recipient, callbackURL },
        {
          onSuccess: () => setMagicLinkRecipient(recipient),
          onError: ({ error }) => setError(error.message),
        },
      );
    }
    setIsPending(false);
  };

  return (
    <>
      <PageHead title={t`Sign in | coragg.io`} />
      <Head>
        <link rel="stylesheet" href={FONTS_URL} />
      </Head>
      <main className="coraggio-login min-h-screen bg-[#1d1912] px-4 pb-16 pt-24 font-[Altivo,system-ui,sans-serif] text-white sm:pt-36">
        <h1 className="mb-14 text-center text-[3.5rem] font-bold leading-none tracking-tight sm:mb-20">
          {CORAGGIO_APP_NAME}
        </h1>
        <div
          className={`mx-auto w-full max-w-[43rem] rounded-lg bg-[#27231e] px-6 py-12 sm:px-14 ${
            // the form's extra top space would leave the short message off-centre
            magicLinkRecipient ? "sm:py-16" : "sm:pt-20"
          }`}
        >
          {magicLinkRecipient ? (
            <div className="text-center text-lg">
              <p className="mb-3 text-2xl font-bold">{t`Check your inbox`}</p>
              <p>
                {/* not <Trans>: fork strings aren't compiled, so production would render the placeholder */}
                {t`Click the link we sent to`} {magicLinkRecipient}{" "}
                {t`to sign in.`}
              </p>
            </div>
          ) : (
            <form onSubmit={signIn} noValidate>
              <div className="space-y-6">
                <input
                  type="email"
                  autoComplete="email"
                  aria-label={t`email address`}
                  placeholder={t`email address`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClassName}
                />
                {isPasswordLogin && (
                  <input
                    type="password"
                    autoComplete="current-password"
                    aria-label={t`password`}
                    placeholder={t`password`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    className={inputClassName}
                  />
                )}
              </div>
              {error && (
                <p className="mt-4 text-center text-sm text-red-400">{error}</p>
              )}
              <div className="mt-10 flex flex-col items-center gap-8">
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-[3.125rem] w-[13.75rem] rounded-full bg-[#eecd5c] text-lg font-semibold uppercase tracking-[0.2em] text-[#1d1912] hover:bg-[#f3d977] disabled:opacity-60"
                >
                  {t`SIGN IN`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordLogin(!isPasswordLogin);
                    setError(null);
                  }}
                  className="text-base text-[#eecd5c] hover:underline"
                >
                  {isPasswordLogin
                    ? t`email me a sign-in link instead`
                    : t`login with password`}
                </button>
              </div>
            </form>
          )}
        </div>
        {(!isSignUpDisabled || redirect?.startsWith("/invite/")) && (
          <p className="mt-6 text-center text-sm text-[#c6c5c3]">
            <Trans>
              Don't have an account?{" "}
              <Link
                href={redirect ? `/signup?next=${redirect}` : "/signup"}
                className="text-[#eecd5c] hover:underline"
              >
                Sign up
              </Link>
            </Trans>
          </p>
        )}
      </main>
    </>
  );
}
