import React, { memo, PropsWithChildren } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { PreBlock } from "./pre-block";
import { isJson, isString, toAny } from "lib/utils";
import JsonView from "ui/json-view";
import { LinkIcon } from "lucide-react";

export type MarkdownVariant = "default" | "roleplay";

const FadeIn = memo(({ children }: PropsWithChildren) => {
  return <span className="fade-in animate-in duration-1000">{children} </span>;
});
FadeIn.displayName = "FadeIn";

export const WordByWordFadeIn = memo(({ children }: PropsWithChildren) => {
  const childrens = [children]
    .flat()
    .flatMap((child) => (isString(child) ? child.split(" ") : child));
  return childrens.map((word, index) =>
    isString(word) ? <FadeIn key={index}>{word}</FadeIn> : word,
  );
});
WordByWordFadeIn.displayName = "WordByWordFadeIn";
const components: Partial<Components> = {
  code: ({ children }) => {
    return (
      <code className="text-sm rounded-md bg-accent text-primary py-1 px-2 mx-0.5">
        {children}
      </code>
    );
  },
  blockquote: ({ children }) => {
    return (
      <div className="px-4">
        <blockquote className="relative bg-accent/30 p-6 rounded-2xl my-6 overflow-hidden border">
          <WordByWordFadeIn>{children}</WordByWordFadeIn>
        </blockquote>
      </div>
    );
  },
  p: ({ children }) => {
    return (
      <p className="leading-6 my-4 break-words">
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </p>
    );
  },
  pre: ({ children }) => {
    return (
      <div className="px-4 py-2">
        <PreBlock>{children}</PreBlock>
      </div>
    );
  },
  ol: ({ node, children, ...props }) => {
    return (
      <ol className="px-8 list-decimal list-outside" {...props}>
        {children}
      </ol>
    );
  },
  li: ({ node, children, ...props }) => {
    return (
      <li className="py-2 break-words" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </li>
    );
  },
  ul: ({ node, children, ...props }) => {
    return (
      <ul className="px-8 list-decimal list-outside" {...props}>
        {children}
      </ul>
    );
  },
  strong: ({ node, children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </span>
    );
  },
  a: ({ node, children, ...props }) => {
    return (
      <a
        className="text-primary hover:underline flex gap-1.5 items-center"
        target="_blank"
        rel="noreferrer"
        {...toAny(props)}
      >
        <LinkIcon className="size-3.5" />
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </a>
    );
  },
  h1: ({ node, children, ...props }) => {
    return (
      <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </h1>
    );
  },
  h2: ({ node, children, ...props }) => {
    return (
      <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </h2>
    );
  },
  h3: ({ node, children, ...props }) => {
    return (
      <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </h3>
    );
  },
  h4: ({ node, children, ...props }) => {
    return (
      <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </h4>
    );
  },
  h5: ({ node, children, ...props }) => {
    return (
      <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </h5>
    );
  },
  h6: ({ node, children, ...props }) => {
    return (
      <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
        <WordByWordFadeIn>{children}</WordByWordFadeIn>
      </h6>
    );
  },
  img: ({ node, children, ...props }) => {
    const { src, alt, ...rest } = props;

    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="mx-auto rounded-lg" src={src} alt={alt} {...rest} />
    ) : null;
  },
};

function sanitizeMarkdown(input: string): string {
  const lines = input.split(/\r?\n/);
  let inFence = false;
  let fenceMarker: "```" | "~~~" | null = null;

  const isFenceLine = (line: string) => {
    const m = line.match(/^ {0,3}(```|~~~)/);
    return (m?.[1] as "```" | "~~~" | undefined) ?? null;
  };

  return lines
    .map((line) => {
      const fence = isFenceLine(line);
      if (fence) {
        if (!inFence) {
          inFence = true;
          fenceMarker = fence;
        } else if (fenceMarker === fence) {
          inFence = false;
          fenceMarker = null;
        }
        return line;
      }

      if (inFence) return line;

      const leading = line.match(/^[ \t]+/)?.[0];
      if (!leading) return line;

      const hasTab = leading.includes("\t");
      const spaceCount = leading.replace(/\t/g, "").length;
      if (!hasTab && spaceCount < 4) return line;

      const nbspPrefix = leading.replace(/\t/g, "    ").replace(/ /g, "\u00A0");
      return nbspPrefix + line.slice(leading.length);
    })
    .join("\n");
}

const NonMemoizedMarkdown = ({
  children,
  variant = "default",
  compact = false,
  narrationOpacity = 0.65,
}: {
  children: string;
  variant?: MarkdownVariant;
  compact?: boolean;
  narrationOpacity?: number;
}) => {
  const mdText = sanitizeMarkdown(children);
  const safeNarrationOpacity = Number.isFinite(narrationOpacity)
    ? Math.min(1, Math.max(0.2, narrationOpacity))
    : 0.65;

  const mdComponents: Partial<Components> =
    variant === "roleplay"
      ? {
          ...components,
          em: ({ children }) => {
            return (
              <span
                className="text-muted-foreground not-italic"
                style={{ opacity: safeNarrationOpacity }}
              >
                <WordByWordFadeIn>{children}</WordByWordFadeIn>
              </span>
            );
          },
        }
      : components;

  const finalComponents: Partial<Components> = compact
    ? {
        ...mdComponents,
        p: ({ children }) => {
          return (
            <p className="leading-6 my-1 break-words">
              <WordByWordFadeIn>{children}</WordByWordFadeIn>
            </p>
          );
        },
      }
    : mdComponents;

  return (
    <article className="w-full h-full relative">
      {isJson(children) ? (
        <JsonView data={children} />
      ) : (
        <ReactMarkdown components={finalComponents} remarkPlugins={[remarkGfm]}>
          {mdText}
        </ReactMarkdown>
      )}
    </article>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.variant === nextProps.variant &&
    prevProps.compact === nextProps.compact &&
    prevProps.narrationOpacity === nextProps.narrationOpacity,
);
