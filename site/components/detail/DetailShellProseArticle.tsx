export default function DetailShellProseArticle({ bodyHtml }: { bodyHtml: string }) {
  return (
    <article
      className="prose-content"
      dangerouslySetInnerHTML={{ __html: bodyHtml }}
    />
  );
}
