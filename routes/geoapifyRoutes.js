// routes/geoapifyRoutes.js
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { fetchLocationAutocomplete } = require('../services/geoapifyService');

// Location autocomplete proxy endpoint using decoupled service layer
router.get('/autocomplete', asyncHandler(async (req, res) => {
    const text = req.query.text?.trim() || '';
    const requestedType = req.query.type?.trim() || '';

    const results = await fetchLocationAutocomplete(text, requestedType);
    res.json({ success: true, results });
}));

module.exports = router;