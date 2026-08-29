import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GameTile } from "@/routes/index";
import { CATEGORIES, GAMES } from "@/lib/games";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore all games — BaaziWin" },
      {
        name: "description",
        content:
          "Browse every BaaziWin title: crash games, mines, dice, roulette and tower climbers.",
      },
      { property: "og:title", content: "Explore all games — BaaziWin" },
      { property: "og:description", content: "Every exciting game in the BaaziWin lobby." },
    ],
  }),
  component: Explore,
});

function Explore() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  const list = GAMES.filter(
    (g) =>
      (cat === "all" || g.categories.includes(cat as never)) &&
      (g.name.toLowerCase().includes(q.toLowerCase()) ||
        g.studio.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <AppShell>
      <div className="px-3 py-4">
        <h1 className="font-display text-2xl font-extrabold">Explore</h1>

        <div className="relative mt-4">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search games or studios"
            aria-label="Search games"
            className="h-12 w-full rounded-xl border border-border bg-surface-lowest pl-10 pr-3 text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {[{ id: "all", label: "All", icon: "✨" }, ...CATEGORIES].map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`label-mono shrink-0 rounded-full border px-3 py-2 ${
                cat === c.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-surface-high text-muted-foreground"
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">No games match “{q}”.</p>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {list.map((g) => (
              <GameTile key={g.slug} slug={g.slug} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
