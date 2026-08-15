// utils/geo.js — distance between two lat/lng points.

/**
 * Haversine formula: the straight-line distance across the surface of a
 * sphere. Accurate enough for "how far away is this neighbour".
 * Returns kilometres.
 */
function distanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // earth radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Privacy: never expose someone's exact coordinates to other users.
 * We shift the point by a small deterministic amount (same user always
 * gets the same offset, so the marker doesn't jump around the map) —
 * roughly a 150 m circle, enough to show the neighbourhood but not the house.
 */
function blurCoordinates(lat, lng, seed) {
  if (lat == null || lng == null) return { latitude: null, longitude: null };

  // A tiny pseudo-random offset derived from the user id.
  const angle = (seed * 137.5) % 360;
  const radius = 0.0012 + ((seed * 37) % 10) * 0.00005;

  return {
    latitude: Number(lat) + radius * Math.cos((angle * Math.PI) / 180),
    longitude: Number(lng) + radius * Math.sin((angle * Math.PI) / 180),
  };
}

/**
 * Privacy: turn "Brusselsesteenweg 45" into "Brusselsesteenweg".
 * Other users see the street, never the house number.
 */
function streetOnly(street) {
  if (!street) return null;
  return street.replace(/\s+\d+\w*$/, '').trim();
}

module.exports = { distanceKm, blurCoordinates, streetOnly };
