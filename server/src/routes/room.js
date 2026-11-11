import express from 'express';
import { randomUUID } from 'node:crypto';

const router = express.Router();

router.post('/create', (_req, res) => {
  return res.status(201).json({ roomId: randomUUID() });
});

export default router;
