"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors">
        <span className="sr-only">Toggle theme</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors bg-transparent hover:bg-neutral-100 dark:hover:bg-white/10"
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 hidden dark:block transition-all" />
      <Moon className="h-5 w-5 block dark:hidden transition-all" />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
