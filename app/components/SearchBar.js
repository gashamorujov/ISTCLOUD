"use client";

import { useState } from "react";
import { IconSearch } from "./Icons";

const ADMIN_TRIGGER = "1006";

export default function SearchBar({ onSearch, placeholder, onAdminTrigger }) {
  const [value, setValue] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed === ADMIN_TRIGGER && onAdminTrigger) {
      onAdminTrigger();
      return;
    }
    onSearch(trimmed);
  }

  function handleChange(e) {
    const v = e.target.value;
    setValue(v);
    onSearch(v.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-400 transition-all duration-200">
        <IconSearch className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          value={value}
          onChange={handleChange}
          type="text"
          placeholder={placeholder || "Fayl adı ilə axtar..."}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 active:scale-95 transition-all duration-150"
        >
          Axtar
        </button>
      </div>
    </form>
  );
}
