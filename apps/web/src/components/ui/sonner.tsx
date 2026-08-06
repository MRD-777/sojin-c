"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "next-themes";

export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      dir="auto"
      toastOptions={{
        style: {
          borderRadius: "12px",
          border: resolvedTheme === "dark" ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.05)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          fontSize: "13px",
          fontWeight: 500,
        },
      }}
      closeButton
      richColors
    />
  );
}
