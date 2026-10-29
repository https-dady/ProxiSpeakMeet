import { importOfficeBlueprint } from '../services/officeBlueprintImportService.js';

/**
 * POST /api/rooms/import-blueprint
 *
 * Imports an office layout from a JSON blueprint.
 * Validation and persistence are handled by the service layer.
 */
export async function importOfficeBlueprintController(req, res, next) {
  try {
    const result = await importOfficeBlueprint(req.body);

    return res.status(201).json({
      ok: true,
      message: 'Office blueprint imported successfully',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export default importOfficeBlueprintController;