"use client";

import { useState } from "react";

export function DisclosureCard({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="disclosureCard">
      <button type="button" className="disclosureToggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div>
          <strong>{title}</strong>
          {subtitle ? <div className="muted disclosureSubtitle">{subtitle}</div> : null}
        </div>
        <span className="disclosureIcon">{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="disclosureBody">{children}</div> : null}
    </div>
  );
}
