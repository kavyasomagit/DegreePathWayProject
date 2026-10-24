import Link from "next/link";
import type { ReactNode } from "react";
import { IconAlert } from "./Icons";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} aria-hidden="true" />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <IconAlert className="mx-auto text-red-600" width={24} height={24} />
      <p className="mt-2 font-semibold text-red-900">Something went wrong</p>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      <button type="button" onClick={onRetry} className={`${btnPrimary} mt-4`}>
        Try again
      </button>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-slate-600">{body}</p>
      <Link href="/questionnaire" className={`${btnPrimary} mt-5`}>
        Take the questionnaire
      </Link>
    </div>
  );
}
