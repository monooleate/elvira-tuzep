import { useState, useRef, useEffect } from "preact/hooks";

interface Props {
  html: string;
}

export default function HtmlExcerpt({ html }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [height, setHeight] = useState("0px");
  const contentRef = useRef<HTMLDivElement>(null);

  const decodedHtml = html;

  // Height recalculation
  useEffect(() => {
    if (!contentRef.current) return;

    if (expanded) {
      const fullHeight = contentRef.current.scrollHeight;
      setHeight(fullHeight + "px");
    } else {
      // Preview height
      setHeight("200px");
    }
  }, [expanded, decodedHtml]);

  // Preview text (2 mondat)
  const temp = typeof window !== "undefined" ? document.createElement("div") : null;
  if (temp) temp.innerHTML = decodedHtml;
  const fullText = temp ? temp.textContent || "" : "";
  const sentences = fullText.split(/(?<=[.!?])\s+/).filter(Boolean);
  const previewText = sentences.slice(0, 1).join(" ");

  return (
    <div class="my-10">
      {/* CONTENT WRAPPER WITH ANIMATION */}
      <div
        class="relative overflow-hidden transition-all duration-300 ease-in-out"
        style={`max-height: ${height};`}
      >
        {/* CONTENT – padding-bottom to avoid button overlap */}
        <div ref={contentRef} class="pb-1">
          {!expanded && (
            <p class="prose prose-sm dark:prose-invert mb-4">{previewText}…</p>
          )}

          {expanded && (
            <div
              class="prose prose-sm dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: decodedHtml }}
            ></div>
          )}
        </div>

        {/* Fade overlay when collapsed */}
        {!expanded && (
          <div class="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-white dark:from-gray-900 to-transparent pointer-events-none"></div>
        )}
      </div>

      {/* EXPAND/COLLAPSE BUTTON */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        class="mt-3 flex items-center gap-2 text-orange-600 dark:text-blue-400 font-medium hover:underline transition"
      >
        <span>{expanded ? "Kevesebb megjelenítése" : "Mutass többet"}</span>

        <svg
          class={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    </div>
  );
}
