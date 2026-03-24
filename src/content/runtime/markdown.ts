import { Marked } from 'marked'
import DOMPurify from 'dompurify'

const markdownParser = new Marked({
  gfm: true,
  breaks: true,
})

export function renderMarkdownToSafeHtml(text: string): string {
  const raw = markdownParser.parse(text) as string
  return DOMPurify.sanitize(raw, { ADD_ATTR: ['target'] })
}
