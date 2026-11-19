"use client";

import React from "react";

/** tombol kecil mandiri (tanpa shadcn) supaya modul 3D bisa dipakai di repo lain */
export function Btn({
  active = false,
  variant = "outline",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; variant?: "outline" | "danger" }) {
  const base =
    "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";
  const style =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : active
      ? "bg-gray-900 text-white"
      : "border border-gray-300 bg-white text-gray-900 hover:bg-gray-100";
  return <button className={`${base} ${style} ${className}`} {...props} />;
}
