import { useRef, useState } from 'react';

import {
  importOfficeBlueprint,
  readOfficeBlueprintFile,
} from '../services/officeBlueprintApi.js';

const ROOMS_UPDATED_EVENT = 'proxispeak:rooms-updated';

export function OfficeBlueprintImporter({ onImported }) {
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files?.[0] ?? null;

    setFile(selectedFile);
    setBlueprint(null);
    setError('');
    setSuccess('');

    if (!selectedFile) {
      return;
    }

    try {
      const parsedBlueprint =
        await readOfficeBlueprintFile(selectedFile);

      if (
        typeof parsedBlueprint.roomId !== 'string' ||
        typeof parsedBlueprint.name !== 'string' ||
        typeof parsedBlueprint.width !== 'number' ||
        typeof parsedBlueprint.height !== 'number'
      ) {
        throw new Error(
          'Blueprint must include roomId, name, width and height.',
        );
      }

      setBlueprint(parsedBlueprint);
    } catch (err) {
      setError(
        err.message || 'Unable to read the blueprint file.',
      );
    }
  };

  const handleImport = async (event) => {
    event.preventDefault();

    if (!blueprint || loading) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await importOfficeBlueprint(blueprint);

      setSuccess(
        `Office "${blueprint.name}" imported successfully.`,
      );

      // Notify room catalogue consumers that a room was added.
      window.dispatchEvent(
        new CustomEvent(ROOMS_UPDATED_EVENT, {
          detail: {
            roomId: blueprint.roomId,
            room: result?.data?.room ?? result?.room ?? null,
          },
        }),
      );

      if (typeof onImported === 'function') {
        onImported(result);
      }

      setFile(null);
      setBlueprint(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(
        err.message || 'The office blueprint could not be imported.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="panel office-blueprint-importer"
      aria-labelledby="office-blueprint-importer-title"
    >
      <header className="panel__header">
        <div>
          <span className="room-info__eyebrow">
            CUSTOM WORKSPACE
          </span>

          <h2 id="office-blueprint-importer-title">
            Import Office Layout
          </h2>
        </div>
      </header>

      <p>
        Import a JSON blueprint to create a room with custom dimensions,
        obstacles and spawn points.
      </p>

      <form onSubmit={handleImport}>
        <div className="office-blueprint-importer__field">
          <label htmlFor="office-blueprint-file">
            Blueprint JSON file
          </label>

          <input
            ref={fileInputRef}
            id="office-blueprint-file"
            name="officeBlueprint"
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            disabled={loading}
            aria-describedby="office-blueprint-file-help"
          />

          <small id="office-blueprint-file-help">
            Select a JSON file containing roomId, name, width,
            height and optional obstacles and spawnPoints.
            Maximum file size: 1 MB.
          </small>
        </div>

        {file && (
          <p className="office-blueprint-importer__filename">
            Selected file: <strong>{file.name}</strong>
          </p>
        )}

        {blueprint && (
          <div
            className="office-blueprint-importer__preview"
            aria-live="polite"
          >
            <h3>Blueprint preview</h3>

            <dl>
              <div>
                <dt>Office name</dt>
                <dd>{blueprint.name}</dd>
              </div>

              <div>
                <dt>Room ID</dt>
                <dd>{blueprint.roomId}</dd>
              </div>

              <div>
                <dt>Dimensions</dt>
                <dd>
                  {blueprint.width} × {blueprint.height}
                </dd>
              </div>

              <div>
                <dt>Obstacles</dt>
                <dd>{blueprint.obstacles?.length ?? 0}</dd>
              </div>

              <div>
                <dt>Spawn points</dt>
                <dd>{blueprint.spawnPoints?.length ?? 0}</dd>
              </div>
            </dl>
          </div>
        )}

        {error && (
          <p
            className="office-blueprint-importer__message office-blueprint-importer__message--error"
            role="alert"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            className="office-blueprint-importer__message office-blueprint-importer__message--success"
            role="status"
          >
            {success}
          </p>
        )}

        <button
          type="submit"
          className="button button--primary"
          disabled={!blueprint || loading}
        >
          {loading ? 'Importing office…' : 'Import Office'}
        </button>
      </form>
    </section>
  );
}

export default OfficeBlueprintImporter;