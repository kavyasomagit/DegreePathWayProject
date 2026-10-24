"use client";

import { IconCheck } from "./Icons";

interface ChipProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function Chip({ label, selected, disabled = false, onToggle }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
        selected
          ? "border-indigo-600 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
          : "border-slate-300 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50"
      } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:bg-white`}
    >
      {selected && <IconCheck width={14} height={14} />}
      {label}
    </button>
  );
}
