// services/geoapifyService.js
const env = require('../config/env');

/**
 * Queries the Geoapify Autocomplete API for Indian campus/institution locations.
 * @param {string} text - Search query input.
 * @param {string} type - Geoapify location feature type filter (e.g., 'amenity' or 'city').
 * @returns {Promise<Array>} Array of mapped location candidates.
 */
async function fetchLocationAutocomplete(text, type = '') {
    if (!text) return [];

    const apiKey = env.GEOAPIFY_API_KEY;
    const ALLOWED_FILTERS = new Set(['amenity', 'city', 'street', 'postcode', 'country', 'state']);
    const typeParam = ALLOWED_FILTERS.has(type) ? `&type=${type}` : '';

    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}` +
                `&filter=countrycode:in&format=json${typeParam}&apiKey=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Geoapify autocomplete API returned status: ${response.status}`);
    }
    const data = await response.json();

    return (data.results || []).map(r => ({
        formatted: r.formatted,
        city: r.city || r.county || '',
        state: r.state || '',
        lat: r.lat,
        lon: r.lon,
        place_id: r.place_id
    }));
}

module.exports = {
    fetchLocationAutocomplete
};