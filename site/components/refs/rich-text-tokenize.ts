const URL_RE = /(https?:\/\/[^\s),]+)/g;
const BACKTICK_RE = /`([^`]+)`/g;
const SITE_PATH_RE = /site\/app\/([a-z0-9-[\]]+)\/page\.tsx/g;

export type RichTextToken = {
  type: "text" | "url" | "code" | "site-route" | "flag" | "file";
  value: string;
  route?: string;
};

function parseTextSegment(text: string, tokens: RichTextToken[]) {
  const combined = new RegExp(
    `(--[a-z][a-z0-9-]*|(?:vendor|\\.planning|\\.agents|evals|bin|lib|scripts|commands)\\/[^\\s,)]+)`,
    "g",
  );
  const parts = text.split(combined);

  for (const part of parts) {
    if (!part) continue;
    if (/^--[a-z]/.test(part)) {
      tokens.push({ type: "flag", value: part });
    } else if (/^(vendor|\.planning|\.agents|evals|bin|lib|scripts|commands)\//.test(part)) {
      tokens.push({ type: "file", value: part });
    } else {
      tokens.push({ type: "text", value: part });
    }
  }
}

export function richTextTokenize(text: string): RichTextToken[] {
  const tokens: RichTextToken[] = [];
  const parts = text.split(BACKTICK_RE);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      tokens.push({ type: "code", value: parts[i] });
    } else {
      const segment = parts[i];
      if (!segment) continue;

      const urlParts = segment.split(URL_RE);
      for (let j = 0; j < urlParts.length; j++) {
        const part = urlParts[j];
        if (!part) continue;

        if (URL_RE.test(part)) {
          URL_RE.lastIndex = 0;
          tokens.push({ type: "url", value: part });
          continue;
        }

        SITE_PATH_RE.lastIndex = 0;
        if (SITE_PATH_RE.test(part)) {
          SITE_PATH_RE.lastIndex = 0;
          const siteParts = part.split(SITE_PATH_RE);
          for (let k = 0; k < siteParts.length; k++) {
            if (k % 2 === 1) {
              const routeName = siteParts[k].replace(/\[.*?\]/g, "");
              tokens.push({
                type: "site-route",
                value: `site/app/${siteParts[k]}/page.tsx`,
                route: `/${routeName}`,
              });
            } else if (siteParts[k]) {
              parseTextSegment(siteParts[k], tokens);
            }
          }
          continue;
        }

        parseTextSegment(part, tokens);
      }
    }
  }

  return tokens;
}
