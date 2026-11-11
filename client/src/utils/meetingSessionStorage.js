const STORAGE_KEY = 'proxispeak:active-meeting';

const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;

const MAX_NAME_LENGTH = 24;

const DEFAULT_COLOR = '#4f8cff';

const ALLOWED_AVATARS = new Set([
  'circle',
  'square',
  'triangle',
  'hex',
]);

function isValidColor(color) {
  return (
    typeof color === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(color)
  );
}

function normalizeMeetingIntent(intent) {
  if (!intent || typeof intent !== 'object') {
    return null;
  }

  const roomId =
    typeof intent.roomId === 'string'
      ? intent.roomId.trim().toLowerCase()
      : '';

  const name =
    typeof intent.name === 'string'
      ? intent.name.trim()
      : '';

  const color = isValidColor(intent.color)
    ? intent.color
    : DEFAULT_COLOR;

  const avatar = ALLOWED_AVATARS.has(intent.avatar)
    ? intent.avatar
    : 'circle';

  if (!ROOM_ID_PATTERN.test(roomId)) {
    return null;
  }

  if (
    !name ||
    name.length > MAX_NAME_LENGTH
  ) {
    return null;
  }

  return {
    roomId,
    name,
    color,
    avatar,
  };
}

export function saveActiveMeeting(intent) {
  const normalizedIntent =
    normalizeMeetingIntent(intent);

  if (!normalizedIntent) {
    return false;
  }

  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        intent: normalizedIntent,
      }),
    );

    return true;
  } catch (error) {
    console.error(
      'Unable to persist active meeting:',
      error.message,
    );

    return false;
  }
}

export function getActiveMeeting() {
  try {
    const storedValue =
      sessionStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    const record = JSON.parse(storedValue);

    if (
      !record ||
      record.version !== 1 ||
      !record.intent ||
      typeof record.savedAt !== 'number'
    ) {
      clearActiveMeeting();
      return null;
    }

    const normalizedIntent =
      normalizeMeetingIntent(record.intent);

    if (!normalizedIntent) {
      clearActiveMeeting();
      return null;
    }

    return normalizedIntent;
  } catch (error) {
    console.error(
      'Unable to restore active meeting:',
      error.message,
    );

    clearActiveMeeting();

    return null;
  }
}

export function clearActiveMeeting() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error(
      'Unable to clear active meeting:',
      error.message,
    );

    return false;
  }
}

export default {
  saveActiveMeeting,
  getActiveMeeting,
  clearActiveMeeting,
};