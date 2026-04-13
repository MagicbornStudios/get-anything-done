import { Identified } from "@/components/devid/Identified";

export default function DetailShellProseArticle({ bodyHtml }: { bodyHtml: string }) {
  return (
    <Identified as="DetailShellProseArticle" className="contents">
      <article className="prose-content" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </Identified>
  );
}
