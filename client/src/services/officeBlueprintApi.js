const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;

function getApiBaseUrl() {
  const serverUrl = import.meta.env.VITE_SERVER_URL;

  if (typeof serverUrl === 'string' && serverUrl.trim()) {
    return serverUrl.trim().replace(/\/+$/, '');
  }

  return 'http://localhost:4000';
}

/**
 * Import a custom office layout through the backend API.
 *
 * @param {object} blueprint - Office blueprint JSON.
 * @returns {Promise<object>} Imported room response.
 */
export async function importOfficeBlueprint(blueprint) {
  if (
    !blueprint ||
    typeof blueprint !== 'object' ||
    Array.isArray(blueprint)
  ) {
    throw new Error('The office blueprint must be a JSON object.');
  }

  if (
    typeof blueprint.roomId !== 'string' ||
    !ROOM_ID_PATTERN.test(blueprint.roomId)
  ) {
    throw new Error(
      'Room ID must start with a lowercase letter or number and contain only lowercase letters, numbers, hyphens, or underscores.',
    );
  }

  const response = await fetch(
    `${getApiBaseUrl()}/api/rooms/import-blueprint`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(blueprint),
    },
  );

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new Error(
      `The server returned an invalid response (HTTP ${response.status}).`,
    );
  }

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        `Office blueprint import failed (HTTP ${response.status}).`,
    );
  }

  return payload;
}

/**
 * Read a JSON blueprint selected from the user's computer.
 *
 * @param {File} file - Selected JSON file.
 * @returns {Promise<object>} Parsed blueprint.
 */
export async function readOfficeBlueprintFile(file) {
  if (!(file instanceof File)) {
    throw new Error('Select a valid JSON blueprint file.');
  }

  if (!file.name.toLowerCase().endsWith('.json')) {
    throw new Error('Only JSON blueprint files are supported.');
  }

  const MAX_FILE_SIZE = 1024 * 1024;

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Blueprint file must be 1 MB or smaller.');
  }

  let blueprint;

  try {
    blueprint = JSON.parse(await file.text());
  } catch {
    throw new Error('The selected file contains invalid JSON.');
  }

  if (
    blueprint === null ||
    typeof blueprint !== 'object' ||
    Array.isArray(blueprint)
  ) {
    throw new Error('The blueprint file must contain a JSON object.');
  }

  return blueprint;
}

export default importOfficeBlueprint;