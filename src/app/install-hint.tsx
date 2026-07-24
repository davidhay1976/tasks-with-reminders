"use client";

import { useEffect, useState } from "react";

// Minimal PWA install nudge. Rules:
//  - If already installed (standalone mode): render nothing
//  - If Chrome / Android fires beforeinstallprompt: show an "Install" button
//  - If iOS Safari and not standalone: show a "Share -> Add to Home Screen" hint
//  - Dismissable; dismissal remembered per-device in localStorage
const DISMISS_KEY = "install_hint_dismissed_v1";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Kind = "none" | "chromium" | "ios";

export function InstallHint() {
  const [kind, setKind] = useState<Kind>("none");
  const [deferred, setDeferred] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    // Detect if already installed.
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // Safari-specific
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    if (isStandalone) return;

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);

    if (isIOS) {
      setKind("ios");
      return;
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setKind("chromium");
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setKind("none");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setKind("none");
  }

  if (kind === "none") return null;

  return (
    <div className="mx-auto mb-4 flex w-full max-w-6xl items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
        ↓
      </span>
      <div className="flex-1">
        {kind === "chromium" ? (
          <p className="text-zinc-800 dark:text-zinc-200">
            Install this app on your device for faster access.
          </p>
        ) : (
          <p className="text-zinc-800 dark:text-zinc-200">
            Tap the <strong>Share</strong> icon in Safari, then{" "}
            <strong>Add to Home Screen</strong>.
          </p>
        )}
      </div>
      {kind === "chromium" && (
        <button
          type="button"
          onClick={install}
          className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          Install
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-zinc-400 hover:text-zinc-600"
      >
        ×
      </button>
    </div>
  );
}
