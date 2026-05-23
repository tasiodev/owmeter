"use client";

export function LocalDate({ iso, locale }: { iso: string; locale: string }) {
  return (
    <>
      {new Date(iso).toLocaleString(locale, {
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    </>
  );
}
