"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium text-gray-200 transition-colors print:hidden"
    >
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3h.25A2.75 2.75 0 0 1 18 8.5v4.75A2.75 2.75 0 0 1 15.25 16H15v1.25A1.75 1.75 0 0 1 13.25 19h-6.5A1.75 1.75 0 0 1 5 17.25V16h-.25A2.75 2.75 0 0 1 2 13.25V8.5A2.75 2.75 0 0 1 4.75 5.75H5v-3Zm1.5 0v3h7v-3a.25.25 0 0 0-.25-.25h-6.5a.25.25 0 0 0-.25.25Zm-2.25 5a1.25 1.25 0 0 0-1.25 1.25v4.5c0 .69.56 1.25 1.25 1.25H5v-2.25A1.75 1.75 0 0 1 6.75 11h6.5A1.75 1.75 0 0 1 15 12.75V15h.25c.69 0 1.25-.56 1.25-1.25V8.5c0-.69-.56-1.25-1.25-1.25H4.25ZM6.5 12.75v4.5c0 .138.112.25.25.25h6.5a.25.25 0 0 0 .25-.25v-4.5a.25.25 0 0 0-.25-.25h-6.5a.25.25 0 0 0-.25.25Z" clipRule="evenodd"/>
      </svg>
      {label}
    </button>
  );
}
