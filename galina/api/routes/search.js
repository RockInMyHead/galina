// Search routes
const express = require('express');
const router = express.Router();
const searchService = require('../services/search');

// Поиск судебных дел
router.post('/court-cases', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string is required' });
    }

    console.log('🔍 Searching court cases for query:', query);

    const result = await searchService.searchCourtCases(query);

    res.json(result);
  } catch (error) {
    console.error('Error searching court cases:', error);
    res.status(500).json({
      error: 'Failed to search court cases',
      details: error.message
    });
  }
});

module.exports = router;
