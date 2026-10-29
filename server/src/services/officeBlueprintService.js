import { ValidationError } from '../utils/errors.js';

const MIN_ROOM_DIMENSION = 200;
const MAX_ROOM_DIMENSION = 10000;
const MAX_OBSTACLES = 500;
const MAX_SPAWN_POINTS = 500;

const ALLOWED_OBSTACLE_TYPES = new Set([
  'wall',
  'desk',
  'plant',
  'pillar',
  'screen',
]);

const DEFAULT_ATTENUATION = Object.freeze({
  wall: 0.12,
  desk: 0.5,
  plant: 0.65,
  pillar: 0.25,
  screen: 0.45,
});

function requireObject(value, field) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new ValidationError(
      `${field} must be a JSON object`,
      { field },
    );
  }
}

function validateText(value, field, maxLength, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(
        `${field} is required`,
        { field },
      );
    }

    return '';
  }

  if (typeof value !== 'string') {
    throw new ValidationError(
      `${field} must be a string`,
      { field },
    );
  }

  const normalized = value.trim();

  if (required && !normalized) {
    throw new ValidationError(
      `${field} cannot be empty`,
      { field },
    );
  }

  if (normalized.length > maxLength) {
    throw new ValidationError(
      `${field} must not exceed ${maxLength} characters`,
      { field },
    );
  }

  return normalized;
}

function validateDimension(value, field) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < MIN_ROOM_DIMENSION ||
    value > MAX_ROOM_DIMENSION
  ) {
    throw new ValidationError(
      `${field} must be a number between ${MIN_ROOM_DIMENSION} and ${MAX_ROOM_DIMENSION}`,
      { field },
    );
  }

  return value;
}

function validateCoordinate(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(
      `${field} must be a finite number`,
      { field },
    );
  }

  return value;
}

function normalizeObstacle(obstacle, index, width, height) {
  const field = `obstacles[${index}]`;

  requireObject(obstacle, field);

  const id = validateText(
    obstacle.id,
    `${field}.id`,
    100,
    { required: true },
  );

  const type = validateText(
    obstacle.type,
    `${field}.type`,
    30,
    { required: true },
  ).toLowerCase();

  if (!ALLOWED_OBSTACLE_TYPES.has(type)) {
    throw new ValidationError(
      `${field}.type must be one of: ${[...ALLOWED_OBSTACLE_TYPES].join(', ')}`,
      { field: `${field}.type` },
    );
  }

  const x = validateCoordinate(obstacle.x, `${field}.x`);
  const y = validateCoordinate(obstacle.y, `${field}.y`);
  const w = validateCoordinate(obstacle.w, `${field}.w`);
  const h = validateCoordinate(obstacle.h, `${field}.h`);

  if (x < 0 || y < 0 || w < 1 || h < 1) {
    throw new ValidationError(
      `${field} must have non-negative coordinates and positive dimensions`,
      { field },
    );
  }

  if (x + w > width || y + h > height) {
    throw new ValidationError(
      `${field} must fit entirely within the room boundaries`,
      { field },
    );
  }

  const blocksAudio =
    obstacle.blocksAudio === undefined
      ? true
      : obstacle.blocksAudio;

  if (typeof blocksAudio !== 'boolean') {
    throw new ValidationError(
      `${field}.blocksAudio must be a boolean`,
      { field: `${field}.blocksAudio` },
    );
  }

  const attenuation =
    obstacle.attenuation === undefined
      ? DEFAULT_ATTENUATION[type]
      : obstacle.attenuation;

  if (
    typeof attenuation !== 'number' ||
    !Number.isFinite(attenuation) ||
    attenuation < 0 ||
    attenuation > 1
  ) {
    throw new ValidationError(
      `${field}.attenuation must be a number between 0 and 1`,
      { field: `${field}.attenuation` },
    );
  }

  return {
    id,
    type,
    x,
    y,
    w,
    h,
    blocksAudio,
    attenuation,
  };
}

function normalizeSpawnPoint(point, index, width, height) {
  const field = `spawnPoints[${index}]`;

  requireObject(point, field);

  const x = validateCoordinate(point.x, `${field}.x`);
  const y = validateCoordinate(point.y, `${field}.y`);

  if (x < 0 || y < 0 || x > width || y > height) {
    throw new ValidationError(
      `${field} must be within the room boundaries`,
      { field },
    );
  }

  return { x, y };
}

/**
 * Validate and normalize an office blueprint submitted as JSON.
 *
 * Accepted structure:
 * {
 *   "roomId": "design-office",
 *   "name": "Design Office",
 *   "description": "Optional description",
 *   "width": 1600,
 *   "height": 1000,
 *   "obstacles": [],
 *   "spawnPoints": []
 * }
 *
 * This function does not persist the room. Persistence is handled by
 * the existing roomService in the next implementation step.
 */
export function validateOfficeBlueprint(input) {
  requireObject(input, 'blueprint');

  const roomId = validateText(
    input.roomId,
    'roomId',
    80,
    { required: true },
  ).toLowerCase();

  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(roomId)) {
    throw new ValidationError(
      'roomId may contain lowercase letters, numbers, hyphens, and underscores',
      { field: 'roomId' },
    );
  }

  const name = validateText(
    input.name,
    'name',
    120,
    { required: true },
  );

  const description = validateText(
    input.description,
    'description',
    500,
  );

  const width = validateDimension(input.width, 'width');
  const height = validateDimension(input.height, 'height');

  const obstacles = input.obstacles ?? [];
  const spawnPoints = input.spawnPoints ?? [];

  if (!Array.isArray(obstacles)) {
    throw new ValidationError(
      'obstacles must be an array',
      { field: 'obstacles' },
    );
  }

  if (obstacles.length > MAX_OBSTACLES) {
    throw new ValidationError(
      `A blueprint cannot contain more than ${MAX_OBSTACLES} obstacles`,
      { field: 'obstacles' },
    );
  }

  if (!Array.isArray(spawnPoints)) {
    throw new ValidationError(
      'spawnPoints must be an array',
      { field: 'spawnPoints' },
    );
  }

  if (spawnPoints.length > MAX_SPAWN_POINTS) {
    throw new ValidationError(
      `A blueprint cannot contain more than ${MAX_SPAWN_POINTS} spawn points`,
      { field: 'spawnPoints' },
    );
  }

  const normalizedObstacles = obstacles.map((obstacle, index) =>
    normalizeObstacle(obstacle, index, width, height),
  );

  const obstacleIds = new Set();

  for (const obstacle of normalizedObstacles) {
    if (obstacleIds.has(obstacle.id)) {
      throw new ValidationError(
        `Duplicate obstacle id "${obstacle.id}"`,
        { field: 'obstacles' },
      );
    }

    obstacleIds.add(obstacle.id);
  }

  const normalizedSpawnPoints = spawnPoints.map((point, index) =>
    normalizeSpawnPoint(point, index, width, height),
  );

  return {
    roomId,
    name,
    description,
    width,
    height,
    obstacles: normalizedObstacles,
    spawnPoints: normalizedSpawnPoints,
  };
}

export default validateOfficeBlueprint;