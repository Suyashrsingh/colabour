import React from "react";

/**
 * Co-Labour brand identity primitive.
 * Uses the SVG logo mark with the approved symbol:
 * forest-green orbit ring, central home, two people, brass doorway, sage bell.
 */
export function BrandMark({ label = "Co-Labour mark", size = 52 }: { label?: string; size?: number }) {
  return (
    <img
      src="/co-labour-logo.svg"
      alt={label}
      width={size}
      height={size}
      style={{ display: "block", flexShrink: 0, minWidth: size }}
      aria-label={label}
    />
  );
}

export function BrandLockup() {
  return (
    <div className="brand-lockup">
      <BrandMark />
      <div>
        <strong>Co-Labour</strong>
        <span>CO-OP SERVICES</span>
      </div>
    </div>
  );
}
