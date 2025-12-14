"use client";

import { useState, useCallback, useMemo } from "react";

type Props = {
  text: string;
  maxLines?: number;
};

export function ActivityText({ text, maxLines = 5 }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Split text into lines
  const lines = useMemo(() => {
    return text.split("\n").filter((line) => line.trim() !== "");
  }, [text]);

  const shouldShowToggle = lines.length > maxLines;
  const displayLines = isExpanded ? lines : lines.slice(0, maxLines);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="whitespace-pre-wrap text-sm text-slate-700">
        {displayLines.map((line, index) => (
          <p key={index} className={index > 0 ? "mt-2" : ""}>
            {line}
          </p>
        ))}
      </div>

      {shouldShowToggle && (
        <button
          type="button"
          onClick={toggleExpanded}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 transition hover:text-blue-700"
        >
          {isExpanded ? (
            <>
              ซ่อน
              <span className="text-xs">▲</span>
            </>
          ) : (
            <>
              แสดงเพิ่มเติม ({lines.length - maxLines} บรรทัด)
              <span className="text-xs">▼</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
