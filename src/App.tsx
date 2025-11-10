import { useMemo, useState } from 'react';
import type { Operation } from 'fast-json-patch';
import JsonEditor from './components/JsonEditor';
import DiffViewer from './components/DiffViewer';
import { modifyPreset, packPreset, uploadPreset, type PresetJson } from './lib/api';

interface StatusMessage {
  type: 'info' | 'error' | 'success';
  text: string;
}

const defaultJsonPlaceholder = '{
  "metadata": {},
  "data": {}
}';

function isPresetJson(value: unknown): value is PresetJson {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return 'metadata' in obj && 'data' in obj;
}

function App() {
  const [filename, setFilename] = useState<string | null>(null);
  const [presetJson, setPresetJson] = useState<PresetJson | null>(null);
  const [editorValue, setEditorValue] = useState<string>(defaultJsonPlaceholder);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [patch, setPatch] = useState<Operation[] | null>(null);
  const [diff, setDiff] = useState<unknown>(null);
  const [lastOriginalJson, setLastOriginalJson] = useState<PresetJson | null>(null);
  const [lastPatchedJson, setLastPatchedJson] = useState<PresetJson | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const metadataEntries = useMemo(() => {
    if (!presetJson) return [] as Array<[string, unknown]>;
    return Object.entries(presetJson.metadata ?? {});
  }, [presetJson]);

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsBusy(true);
    setStatus({ type: 'info', text: 'Uploading and unpacking preset…' });
    setEditorError(null);
    setPatch(null);
    setDiff(null);
    setLastOriginalJson(null);
    setLastPatchedJson(null);

    try {
      const response = await uploadPreset(file);
      const json: PresetJson = { metadata: response.metadata, data: response.data };
      setFilename(response.filename);
      setPresetJson(json);
      setEditorValue(JSON.stringify(json, null, 2));
      setStatus({ type: 'success', text: 'Preset unpacked successfully.' });
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', text: error instanceof Error ? error.message : 'Failed to unpack preset.' });
    } finally {
      setIsBusy(false);
    }
  };

  const handleEditorChange = (value: string) => {
    setEditorValue(value);
    try {
      const parsed = JSON.parse(value);
      if (isPresetJson(parsed)) {
        setPresetJson(parsed);
        setEditorError(null);
      } else {
        setEditorError('Root JSON must contain "metadata" and "data" keys.');
      }
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  const handleInstructionChange: React.ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    setInstruction(event.target.value);
  };

  const handleModify = async () => {
    if (!presetJson) {
      setStatus({ type: 'error', text: 'Upload a preset and ensure the JSON is valid before modifying.' });
      return;
    }

    if (editorError) {
      setStatus({ type: 'error', text: 'Fix JSON errors before applying instructions.' });
      return;
    }

    if (!instruction.trim()) {
      setStatus({ type: 'error', text: 'Enter an instruction to modify the preset.' });
      return;
    }

    setIsBusy(true);
    setStatus({ type: 'info', text: 'Requesting patch proposal…' });

    try {
      const original = presetJson;
      const response = await modifyPreset({ json: original, instruction });
      setPatch(response.patch);
      setDiff(response.diff);
      setLastOriginalJson(original);
      setLastPatchedJson(response.patchedJson);
      setPresetJson(response.patchedJson);
      setEditorValue(JSON.stringify(response.patchedJson, null, 2));
      setStatus({ type: 'success', text: 'Patch applied successfully.' });
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', text: error instanceof Error ? error.message : 'Failed to apply patch.' });
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownload = async () => {
    if (!presetJson) {
      setStatus({ type: 'error', text: 'Nothing to download yet. Upload a preset first.' });
      return;
    }

    setIsBusy(true);
    setStatus({ type: 'info', text: 'Packing preset…' });

    try {
      const blob = await packPreset({ json: presetJson, filename: filename ?? undefined });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = (filename ?? 'edited-preset').replace(/\.[^/.]+$/, '');
      link.href = url;
      link.download = `${safeName}.SerumPreset`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', text: 'Download ready.' });
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', text: error instanceof Error ? error.message : 'Failed to pack preset.' });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main>
      <header>
        <h1>Serum 2 Preset Editor</h1>
        <p className="small">Local-first workflow for unpacking, editing, diffing, and re-packing Serum 2 presets.</p>
      </header>

      <section>
        <h2>1. Upload preset</h2>
        <input type="file" accept=".SerumPreset" onChange={handleFileChange} disabled={isBusy} />
        {filename ? <p className="json-meta">Loaded: <strong>{filename}</strong></p> : null}
        {status ? (
          <p className={`small badge ${status.type}`}>{status.text}</p>
        ) : null}
      </section>

      <section>
        <h2>2. Inspect &amp; edit JSON</h2>
        {metadataEntries.length ? (
          <div className="json-meta">
            <strong>Metadata:</strong>{' '}
            {metadataEntries.map(([key, value]) => (
              <span key={key} style={{ marginRight: '0.75rem' }}>
                {key}: <code>{String(value)}</code>
              </span>
            ))}
          </div>
        ) : (
          <p className="small">Metadata will appear here after uploading a preset.</p>
        )}
        <JsonEditor value={editorValue} onChange={handleEditorChange} />
        {editorError ? <p className="small" style={{ color: '#f87171' }}>{editorError}</p> : null}
      </section>

      <section>
        <h2>3. Describe your change</h2>
        <label htmlFor="instruction">Instruction</label>
        <textarea
          id="instruction"
          placeholder="e.g. Raise filter cutoff to 800 Hz and reduce OSC1 level to 0.8"
          value={instruction}
          onChange={handleInstructionChange}
          disabled={isBusy}
        />
        <div className="controls">
          <button type="button" onClick={handleModify} disabled={isBusy}>
            Generate patch
          </button>
          <button type="button" onClick={handleDownload} disabled={isBusy || !presetJson}>
            Download .SerumPreset
          </button>
        </div>
      </section>

      <section>
        <h2>4. Patch preview</h2>
        {patch && patch.length > 0 ? (
          <table className="patch-table">
            <thead>
              <tr>
                <th>op</th>
                <th>path</th>
                <th>value</th>
              </tr>
            </thead>
            <tbody>
              {patch.map((operation, index) => (
                <tr key={`${operation.path}-${index}`}>
                  <td>{operation.op}</td>
                  <td><code>{operation.path}</code></td>
                  <td>
                    {'value' in operation ? (
                      <code>{JSON.stringify((operation as { value?: unknown }).value)}</code>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="small">No patch proposed yet.</p>
        )}
        <DiffViewer
          original={lastOriginalJson ?? presetJson}
          patched={lastPatchedJson ?? presetJson}
          diff={diff}
        />
      </section>
    </main>
  );
}

export default App;
