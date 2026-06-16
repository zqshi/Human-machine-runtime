import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Icon } from '../../../components/ui/Icon';
import { useToastStore } from '../../../../application/stores/toastStore';
import { uploadApi } from '../../../../application/services/apiGateway';
import type { PanelProps } from '../panelRegistry';

function DocToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {

  if (!editor) return null;

  const btn = (
    icon: string,
    action: () => void,
    active?: boolean,
    title?: string,
    className?: string
  ) => (
    <button
      type="button"
      onClick={action}
      className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
        active
          ? 'text-primary bg-primary/10'
          : `text-text-secondary hover:bg-bg-hover ${className ?? ''}`
      }`}
      title={title}
    >
      <Icon name={icon} size={16} />
    </button>
  );

  const handleInsertLink = () => {
    const href = window.prompt('输入链接 URL:');
    if (!href) return;
    editor.chain().focus().setLink({ href }).run();
  };

  const handleInsertImage = () => {
    document.getElementById('doc-panel-img-input')?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file: uploaded } = await uploadApi.upload(file);
      editor.chain().focus().setImage({ src: uploaded.url }).run();
    } catch {
      useToastStore.getState().addToast('图片上传失败', 'error');
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border shrink-0">
      {btn(
        'format_bold',
        () => editor.chain().focus().toggleBold().run(),
        editor.isActive('bold'),
        '加粗'
      )}
      {btn(
        'format_italic',
        () => editor.chain().focus().toggleItalic().run(),
        editor.isActive('italic'),
        '斜体'
      )}
      {btn(
        'format_strikethrough',
        () => editor.chain().focus().toggleStrike().run(),
        editor.isActive('strike'),
        '删除线'
      )}
      {btn(
        'format_list_bulleted',
        () => editor.chain().focus().toggleBulletList().run(),
        editor.isActive('bulletList'),
        '无序列表'
      )}
      {btn(
        'format_list_numbered',
        () => editor.chain().focus().toggleOrderedList().run(),
        editor.isActive('orderedList'),
        '有序列表'
      )}
      {btn(
        'title',
        () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        editor.isActive('heading', { level: 3 }),
        '标题'
      )}
      {btn(
        'format_quote',
        () => editor.chain().focus().toggleBlockquote().run(),
        editor.isActive('blockquote'),
        '引用'
      )}
      {btn(
        'code',
        () => editor.chain().focus().toggleCodeBlock().run(),
        editor.isActive('codeBlock'),
        '代码块'
      )}
      <div className="w-px h-4 bg-border mx-0.5" />
      {btn('link', handleInsertLink, editor.isActive('link'), '插入链接')}
      {btn('image', handleInsertImage, false, '插入图片')}
      {btn(
        'auto_awesome',
        () => useToastStore.getState().addToast('AI 辅助即将上线', 'info'),
        false,
        'AI 辅助',
        'text-primary hover:bg-primary/5'
      )}
      <input
        id="doc-panel-img-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />
    </div>
  );
}

export default function DocPanel({ data, onChange }: PanelProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '开始编辑...' }),
      Link.configure({ openOnClick: false }),
      Image,
    ],
    content: (data.html as string) ?? '',
    onUpdate: ({ editor: e }) => {
      onChange?.({ ...data, html: e.getHTML() });
    },
  });

  return (
    <div className="flex flex-col h-full">
      <DocToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="flex-1 overflow-auto p-4 dcf-scrollbar prose prose-sm max-w-none text-text-primary"
      />
    </div>
  );
}
