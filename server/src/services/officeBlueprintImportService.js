import mongoose from 'mongoose';

import Room from '../models/Room.js';
import {
  listRooms,
  persistRoom,
} from './roomService.js';
import { validateOfficeBlueprint } from './officeBlueprintService.js';
import { ValidationError, ServiceError } from '../utils/errors.js';

/**
 * Import a validated office blueprint into the existing room system.
 *
 * Room IDs cannot be overwritten. Successful persistence uses roomService
 * so existing geometry checks, cache management and retry behavior remain
 * part of the room lifecycle.
 */
export async function importOfficeBlueprint(input) {
  const blueprint = validateOfficeBlueprint(input);

  // Reject duplicates already visible in the existing room catalogue.
  const rooms = await listRooms();

  if (rooms.some((room) => room.roomId === blueprint.roomId)) {
    throw new ValidationError(
      `Room "${blueprint.roomId}" already exists`,
      { field: 'roomId', value: blueprint.roomId },
    );
  }

  // The database check is important because listRooms() is limited.
  if (mongoose.connection.readyState !== 1) {
    throw new ServiceError(
      'Database is unavailable. Connect to MongoDB before importing a custom office.',
      { status: 503 },
    );
  }

  const existingRoom = await Room.exists({
    roomId: blueprint.roomId,
  });

  if (existingRoom) {
    throw new ValidationError(
      `Room "${blueprint.roomId}" already exists`,
      { field: 'roomId', value: blueprint.roomId },
    );
  }

  // Persist through the existing service instead of bypassing room lifecycle.
  const persistedRoom = await persistRoom(blueprint);

  return {
    success: true,
    room: persistedRoom,
  };
}

export default importOfficeBlueprint;