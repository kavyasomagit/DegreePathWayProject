import { IconInfo } from "./Icons";

export function SyntheticBanner() {
  return (
    <div role="note" className="bg-amber-50 text-amber-900 border-b border-amber-200">
      <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-medium sm:text-sm">
        <IconInfo className="shrink-0" />
        <span>Demo with synthetic data. All students, alumni, courses and outcomes are fictional.</span>
      </p>
    </div>
  );
}
