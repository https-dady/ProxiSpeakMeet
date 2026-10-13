import mongoose from 'mongoose';

/**
 * Every Spatial Audit run is persisted so the "queries stay under 20 ms"
 * claim can be demonstrated over time instead of being a one-off console line.
 */
const SpatialAuditSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, index: true },
    source: { type: String, enum: ['http', 'cli', 'scheduler'], required: true },
    trigger: { type: String, required: true }, // near | within | cluster | explain
    budgetMs: { type: Number, required: true },
    minMs: { type: Number, required: true },
    avgMs: { type: Number, required: true },
    p95Ms: { type: Number, required: true },
    maxMs: { type: Number, required: true },
    matched: { type: Number, default: 0 },
    indexUsed: { type: String, default: '' },
    withinBudget: { type: Boolean, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    instanceId: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

SpatialAuditSchema.index({ roomId: 1, createdAt: -1 });

export const SpatialAudit = mongoose.models.SpatialAudit || mongoose.model('SpatialAudit', SpatialAuditSchema);

export default SpatialAudit;