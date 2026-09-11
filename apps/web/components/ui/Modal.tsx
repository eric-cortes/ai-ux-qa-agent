"use client";

import { useEffect, useId, type ReactNode } from "react";
import { clsx } from "clsx";

import { Button } from "./Button";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby={titleId} className={clsx("max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-lime-spark bg-panel p-5 shadow-2xl", className)} onClick={(event) => event.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between gap-4"><h2 id={titleId} className="m-0 text-lg font-semibold">{title}</h2><Button variant="outline" size="sm" type="button" autoFocus onClick={onClose}>Close</Button></div>
      {children}
    </section>
  </div>;
}
