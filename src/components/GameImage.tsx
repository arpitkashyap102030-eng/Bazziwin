import { useState } from "react";

type GameImageProps = {
  src?: string;
  alt: string;
  className?: string;
  icon?: string;
  fallbackTitle?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
};

export function GameImage({
  src,
  alt,
  className = "",
  icon = "🎮",
  fallbackTitle,
  width = 512,
  height = 512,
  loading = "lazy",
}: GameImageProps) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className={`flex size-full flex-col items-center justify-center bg-gradient-to-br from-surface-high via-surface-mid to-surface-low p-2 text-center select-none ${className}`}
      >
        <span className="text-2xl drop-shadow">{icon}</span>
        {fallbackTitle && (
          <span className="mt-1 line-clamp-1 font-display text-[10px] font-bold text-muted-foreground uppercase">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
      className={className}
    />
  );
}
