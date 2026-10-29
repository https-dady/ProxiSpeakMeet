import mongoose from 'mongoose';

import Room from '../models/Room.js';
import {
  listRooms,
  persistRoom,
} from './roomService.js';
import { validateOfficeBlueprint } from './officeBlueprintService.js';
import { ValidationError } from '../utils/errors.js';

/**
 * Import a validated office blueprint into the existing room system.
 *
 * Existing room IDs cannot be overwritten by this import operation.
 * Actual persistence continues through roomService so its existing
 * validation, cache, and retry behavior remain in place.
 */
export async function importOfficeBlueprint(input) {
  const blueprint = validateOfficeBlueprint(input);

  // Avoid importing a room that is already present in the in-memory
  // catalogue, including rooms waiting for persistence.
  const rooms = await listRooms();

  if (rooms.some((room) => room.roomId === blueprint.roomId)) {
    throw new ValidationError(
      `Room "${blueprint.roomId}" already exists`,
      { field: 'roomId', value: blueprint.roomId },
    );
  }

  // Check MongoDB directly as well. The catalogue has a result limit,
  // so it must not be the only duplicate-protection mechanism.
  if (mongoose.connection.readyState === 1) {
    const existingRoom = await Room.exists({
      roomId: blueprint.roomId,
    });

    if (existingRoom) {
      throw new ValidationError(
        `Room "${blueprint.roomId}" already exists`,
        { field: 'roomId', value: blueprint.roomId },
      );
    }
  }

  // The existing persistence service owns MongoDB writes and retry logic.
  const persistedRoom = await persistRoom(blueprint);

  return {
    success: true,
    room: persistedRoom,
  };
}

export default importOfficeBlueprint;