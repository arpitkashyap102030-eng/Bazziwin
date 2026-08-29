import { useState } from "react";
import { Rocket, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CURRENT_APP_VERSION } from "@/config/version";
import { compareVersions, useAppConfig } from "@/lib/app-config";

/**
 * Blocks the app when a newer build is published.
 * Any fetch failure resolves to `null` config, so the gate stays silent.
 */
export function UpdateGate() {
  const { data: config } = useAppConfig();
  const [skipped, setSkipped] = useState(false);

  if (!config?.latest_version) return null;
  if (compareVersions(config.latest_version, CURRENT_APP_VERSION) <= 0) return null;
  if (skipped && !config.force_update) return null;

  const open = () => {
    if (!config.apk_url) return;
    window.open(config.apk_url, "_system") ?? window.open(config.apk_url, "_blank");
  };

  return (
    <Dialog open>
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-[340px] rounded-2xl border-primary/40 bg-surface-low shadow-[var(--shadow-glow)] [&>button]:hidden"
      >
        <DialogHeader className="items-center text-center">
          <div className="animate-glow mb-2 grid size-14 place-items-center rounded-full border border-primary/50 bg-primary/15">
            <Rocket className="size-7 text-primary" aria-hidden />
          </div>
          <DialogTitle className="font-display text-xl font-extrabold">
            New Update Available 🚀
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Version <span className="font-mono font-bold text-accent">{config.latest_version}</span>{" "}
            is ready. You are on <span className="font-mono">{CURRENT_APP_VERSION}</span>.
          </DialogDescription>
        </DialogHeader>

        {config.release_notes ? (
          <div className="rounded-xl border border-border bg-surface-lowest p-3">
            <p className="label-mono text-muted-foreground">What's new</p>
            <p className="mt-1 whitespace-pre-line text-sm text-foreground">
              {config.release_notes}
            </p>
          </div>
        ) : null}

        <button
          onClick={open}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-display text-base font-bold text-primary-foreground active:scale-[0.98]"
        >
          <Download className="size-4" aria-hidden />
          Update Now
        </button>

        {config.force_update ? (
          <p className="text-center text-xs text-muted-foreground">
            This update is required to keep playing.
          </p>
        ) : (
          <button
            onClick={() => setSkipped(true)}
            className="label-mono text-muted-foreground underline-offset-4 hover:underline"
          >
            Later
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
