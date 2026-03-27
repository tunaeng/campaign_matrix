import { Typography } from 'antd';
import DOMPurify from 'dompurify';

const SANITIZE = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
    'ul', 'ol', 'li', 'a', 'span', 'blockquote', 'code', 'pre',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
};

type Props = {
  html: string;
};

/** Безопасный вывод HTML из чек-листа (после TipTap). */
export default function ChecklistRichTextHtml({ html }: Props) {
  if (!html?.trim()) {
    return <Typography.Text type="secondary">—</Typography.Text>;
  }
  return (
    <div
      className="checklist-rich-html"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, SANITIZE) }}
    />
  );
}
