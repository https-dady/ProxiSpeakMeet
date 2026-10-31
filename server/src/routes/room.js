const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

router.post('/create', (req, res) => {
  // Unique room ID generate kar rahe hain
  const roomId = uuidv4();
  res.json({ roomId });
});

module.exports = router;