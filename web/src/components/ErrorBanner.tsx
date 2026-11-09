interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div role="alert" className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p>{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="rounded px-1 font-semibold leading-none hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        ×
      </button>
    </div>
  );
}
