import { roundsMdParseBlocks, roundsMdSplitRow } from "./rounds-markdown-parse";
import { roundsMdRenderInline } from "./rounds-markdown-inline";

type Props = {
  body: string;
};

export function RoundsMarkdownBody({ body }: Props) {
  const blocks = roundsMdParseBlocks(body);

  return (
    <div className="space-y-4 text-sm leading-6 text-muted-foreground">
      {blocks.map((block, idx) => {
        if (block.type === "para") {
          return (
            <p key={idx} className="whitespace-pre-line">
              {roundsMdRenderInline(block.content.join("\n"))}
            </p>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={idx} className="list-disc space-y-1 pl-5">
              {block.content.map((bullet, j) => (
                <li key={j}>{roundsMdRenderInline(bullet)}</li>
              ))}
            </ul>
          );
        }
        const [headerLine, , ...dataLines] = block.content;
        const headerCells = roundsMdSplitRow(headerLine);
        const rows = dataLines.map(roundsMdSplitRow);
        return (
          <div
            key={idx}
            className="overflow-x-auto rounded-lg border border-border/60 bg-background/40"
          >
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  {headerCells.map((c, j) => (
                    <th key={j} className="px-3 py-2 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-transparent" : "bg-background/30"}>
                    {row.map((c, j) => (
                      <td key={j} className="px-3 py-2 tabular-nums">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
