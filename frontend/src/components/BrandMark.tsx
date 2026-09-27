import React from "react";

/**
 * Co-Labour brand identity primitive.
 * Uses the official CoLabour emblem and wordmark logo.
 */
export function BrandMark({
  label = "Co-Labour — Cooperative Digital Service Marketplace",
  size,
  height,
  className = "",
}: {
  label?: string;
  size?: number;
  height?: number;
  className?: string;
}) {
  const h = height || size || 40;
  return (
    <img
      src="/colabour-logo.png"
      alt={label}
      height={h}
      className={className}
      style={{
        display: "block",
        flexShrink: 0,
        height: `${h}px`,
        width: "auto",
        maxWidth: "100%",
        objectFit: "contain",
      }}
      aria-label={label}
    />
  );
}

export function BrandLockup({
  height = 40,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div className={`brand-lockup ${className}`} style={{ alignItems: "center" }}>
      <BrandMark height={height} />
    </div>
  );
}

