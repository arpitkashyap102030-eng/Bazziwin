import { Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";

export function SignInGate({ what = "play" }: { what?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-low p-6 text-center">
      <p className="text-sm text-muted-foreground">
        Sign in to {what} and get 1,000 free arcade coins.
      </p>
      <Link
        to="/auth"
        search={{ mode: "up" }}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground active:scale-95"
      >
        <LogIn className="size-4" aria-hidden />
        Create free account
      </Link>
    </div>
  );
}
