import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { defaultKeymap } from '@codemirror/commands';
import { history, historyKeymap } from '@codemirror/history';

export interface JsonEditorProps {
  value: string;
  onChange?: (value: string) => void;
}

const editorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: '#e2e8f0',
      fontSize: '14px'
    },
    '.cm-content': {
      caretColor: '#38bdf8'
    },
    '&.cm-focused .cm-cursor': { borderLeftColor: '#38bdf8' },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(14, 165, 233, 0.35)'
    },
    '.cm-gutters': {
      backgroundColor: 'rgba(2, 6, 23, 0.95)',
      color: '#64748b',
      border: 'none'
    }
  },
  { dark: true }
);

export function JsonEditor({ value, onChange }: JsonEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChange) {
        const doc = update.state.doc.toString();
        valueRef.current = doc;
        onChange(doc);
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        json(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        editorTheme,
        EditorView.lineWrapping,
        updateListener
      ]
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!viewRef.current) return;
    if (value === valueRef.current) return;
    const view = viewRef.current;
    valueRef.current = value;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value }
    });
  }, [value]);

  return <div className="json-editor" ref={editorRef} />;
}

export default JsonEditor;
