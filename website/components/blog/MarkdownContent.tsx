/**
 * MarkdownContent — Phase 19.11 — render markdown + video embed.
 *
 * Pre-process markdown:
 *   - {{youtube:VIDEO_ID}} → iframe YouTube
 *   - {{vimeo:VIDEO_ID}}   → iframe Vimeo
 *
 * Sau đó parse markdown qua `marked` → HTML.
 *
 * Style cho dark cyber theme — heading đậm, code block dark gray nền,
 * link accent màu xanh, table border subtle.
 */
import { marked } from 'marked';

interface Props {
  markdown: string;
}

marked.setOptions({
  gfm: true,
  breaks: false,
});

const YOUTUBE_RE = /\{\{youtube:([a-zA-Z0-9_-]{6,15})\}\}/g;
const VIMEO_RE = /\{\{vimeo:(\d{5,12})\}\}/g;

function preprocessVideoEmbeds(md: string): string {
  return md
    .replace(
      YOUTUBE_RE,
      (_m, id) =>
        `<div class="blog-video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>`,
    )
    .replace(
      VIMEO_RE,
      (_m, id) =>
        `<div class="blog-video-embed"><iframe src="https://player.vimeo.com/video/${id}" title="Vimeo" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`,
    );
}

export function MarkdownContent({ markdown }: Props) {
  const preprocessed = preprocessVideoEmbeds(markdown);
  const html = marked.parse(preprocessed, { async: false }) as string;

  return (
    <article
      className="blog-prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
