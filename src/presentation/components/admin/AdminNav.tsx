"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";

const links = [
  { href: "/dashboard/admin/users", label: "Users" },
  { href: "/dashboard/admin/false-positives", label: "False Positives" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-gray-800 pb-0">
      {links.map(({ href, label }) => {
        const active = pathname.includes(href.split("/").at(-1)!);
        return (
          <Link
            key={href}
            href={href}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              active
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
