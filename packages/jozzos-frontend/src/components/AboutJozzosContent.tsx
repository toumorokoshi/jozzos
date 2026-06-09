import React from "react";
import aboutMarkdown from "./AboutJozzos.md?raw";

const parseInline = (text: string): React.ReactNode[] => {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

const parseBlocks = (markdown: string): React.ReactNode => {
  const blocks = markdown.split(/\n\n+/);
  return (
    <>
      {blocks.map((block, blockIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Header
        if (trimmed.startsWith("#### ")) {
          return (
            <h4
              key={blockIdx}
              style={{
                margin: "0 0 0.5rem 0",
                color: "var(--text-primary)",
                fontSize: "1rem",
              }}
            >
              {parseInline(trimmed.slice(5))}
            </h4>
          );
        }

        const lines = trimmed.split("\n");

        // Unordered List
        if (lines[0].trim().startsWith("- ")) {
          return (
            <ul
              key={blockIdx}
              style={{
                margin: 0,
                paddingLeft: "1.2rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              {lines.map((line, lineIdx) => {
                const content = line.replace(/^\s*-\s+/, "");
                return <li key={lineIdx}>{parseInline(content)}</li>;
              })}
            </ul>
          );
        }

        // Ordered List
        if (/^\d+\.\s+/.test(lines[0].trim())) {
          return (
            <ol
              key={blockIdx}
              style={{
                margin: 0,
                paddingLeft: "1.2rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              {lines.map((line, lineIdx) => {
                const content = line.replace(/^\s*\d+\.\s+/, "");
                return <li key={lineIdx}>{parseInline(content)}</li>;
              })}
            </ol>
          );
        }

        // Paragraph
        return (
          <p key={blockIdx} style={{ margin: 0 }}>
            {parseInline(trimmed)}
          </p>
        );
      })}
    </>
  );
};

export const AboutJozzosContent: React.FC = () => {
  return parseBlocks(aboutMarkdown);
};
