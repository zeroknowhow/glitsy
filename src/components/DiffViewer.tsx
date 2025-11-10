import { useEffect, useRef } from 'react';
import { formatters } from 'jsondiffpatch';
import 'jsondiffpatch/dist/formatters-styles/annotated.css';

export interface DiffViewerProps {
  original: unknown;
  patched: unknown;
  diff: unknown;
}

export function DiffViewer({ original, patched, diff }: DiffViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (!diff) {
      containerRef.current.innerHTML = '<p>No changes proposed.</p>';
      return;
    }

    try {
      const html = formatters.html.format(diff, original);
      containerRef.current.innerHTML = html;
    } catch (error) {
      console.error('Unable to render diff:', error);
      containerRef.current.innerHTML = `<pre>${JSON.stringify({ original, patched, diff }, null, 2)}</pre>`;
    }
  }, [diff, original, patched]);

  return <div className="diff-container diff-styles" ref={containerRef} />;
}

export default DiffViewer;
