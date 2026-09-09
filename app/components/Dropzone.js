"use client";

import { useState, useRef } from "react";
import { IconUpload } from "./Icons";

export default function Dropzone({ onFilesSelected }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }
  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFilesSelected(files);
  }
  function handleClick() {
    inputRef.current?.click();
  }
  function handleChange(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) onFilesSelected(files);
    e.target.value = "";
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
        dragging
          ? "border-indigo-400 bg-indigo-50/60"
          : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleChange}
        className="hidden"
      />
      <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200 ${
        dragging ? "bg-indigo-200" : "bg-indigo-100"
      }`}>
        <IconUpload className={`w-6 h-6 transition-colors duration-200 ${dragging ? "text-indigo-600" : "text-indigo-500"}`} />
      </div>
      <p className="text-sm font-medium text-slate-600">
        {dragging ? "Faylları bura buraxın" : "Faylları sürükləyin və ya basın"}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Şəkil, video, PDF, Word, Excel, ZIP və digər formatlar
      </p>
    </div>
  );
}
