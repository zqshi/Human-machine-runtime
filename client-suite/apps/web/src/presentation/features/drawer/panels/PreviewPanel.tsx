import type { PanelProps } from '../panelRegistry';

export default function PreviewPanel({ data }: PanelProps) {
  const html = (data.previewHtml as string) ?? '';
  return (
    <iframe srcDoc={html} title="preview" className="w-full h-full border-0" sandbox="allow-scripts" />
  );
}
