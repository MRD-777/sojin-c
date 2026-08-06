import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ["en", "ar"],

  // Used when no locale matches
  defaultLocale: "ar",

  // Enable locales in the path, e.g. /en/dashboard
  localePrefix: "always",
});

// Lightweight wrappers around Next.js' navigation APIs
// that will automatically handle the current locale.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
