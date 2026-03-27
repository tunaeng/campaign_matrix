import { useEffect, useCallback } from 'react';
import { Button, Space } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';

type Props = {
  value: string;
  onSave: (html: string) => void;
  placeholder?: string;
};

function toolbarPreventFocus(e: React.MouseEvent) {
  e.preventDefault();
}

function normalizeHtml(html: string): string {
  const t = html.trim();
  if (!t || t === '<p></p>') return '';
  if (t.startsWith('<p>') && t.includes('ProseMirror-trailingBreak') && t.endsWith('</p>')) {
    return '';
  }
  return html;
}

export default function ChecklistRichTextEditor({
  value,
  onSave,
  placeholder = 'Введите текст подтверждения',
}: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'checklist-editor__prose',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (incoming === editor.getHTML()) return;
    editor.commands.setContent(incoming, { emitUpdate: false });
  }, [value, editor]);

  const flushSave = useCallback(() => {
    if (!editor) return;
    const html = normalizeHtml(editor.isEmpty ? '' : editor.getHTML());
    if (html === normalizeHtml(value || '')) return;
    onSave(html);
  }, [editor, onSave, value]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const onBlur = () => flushSave();
    dom.addEventListener('blur', onBlur, true);
    return () => dom.removeEventListener('blur', onBlur, true);
  }, [editor, flushSave]);

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Адрес ссылки', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="checklist-rich-editor">
      <Space wrap size={4} className="checklist-rich-editor__toolbar">
        <Button
          size="small"
          type={editor.isActive('bold') ? 'primary' : 'default'}
          icon={<BoldOutlined />}
          onMouseDown={toolbarPreventFocus}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <Button
          size="small"
          type={editor.isActive('italic') ? 'primary' : 'default'}
          icon={<ItalicOutlined />}
          onMouseDown={toolbarPreventFocus}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <Button
          size="small"
          type={editor.isActive('underline') ? 'primary' : 'default'}
          icon={<UnderlineOutlined />}
          onMouseDown={toolbarPreventFocus}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <Button
          size="small"
          type={editor.isActive('strike') ? 'primary' : 'default'}
          icon={<StrikethroughOutlined />}
          onMouseDown={toolbarPreventFocus}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <Button
          size="small"
          type={editor.isActive('bulletList') ? 'primary' : 'default'}
          icon={<UnorderedListOutlined />}
          onMouseDown={toolbarPreventFocus}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <Button
          size="small"
          type={editor.isActive('orderedList') ? 'primary' : 'default'}
          icon={<OrderedListOutlined />}
          onMouseDown={toolbarPreventFocus}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <Button
          size="small"
          type={editor.isActive('link') ? 'primary' : 'default'}
          icon={<LinkOutlined />}
          onMouseDown={toolbarPreventFocus}
          onClick={setLink}
        />
      </Space>
      <div className="checklist-rich-editor__body">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
