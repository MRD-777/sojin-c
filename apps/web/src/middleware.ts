import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextResponse, type NextRequest } from "next/server";
import { decideAuthRedirect } from "./lib/auth/decide-redirect";
import { AUTH_HINT_NAME } from "./lib/auth/auth-hint";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // i18n first — sets locale cookies / rewrites.
  const response = intlMiddleware(request);

  // Auth gating is driven purely by the readable `auth_hint` cookie on the web
  // origin. The httpOnly refresh cookie lives on the API origin (:4000) and is
  // invisible here, so we never call Supabase from the middleware anymore.
  const hasHint = request.cookies.get(AUTH_HINT_NAME)?.value === "1";

  const target = decideAuthRedirect({
    pathname: request.nextUrl.pathname,
    hasHint,
    locales: routing.locales,
    defaultLocale: routing.defaultLocale,
  });

  if (target) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Match only internationalized pathnames
  matcher: ["/", "/(ar|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
