// utils/matching.js — the helper-matching engine.
//
// This is the heart of the product, so it is deliberately explainable
// rather than a black box. Every match comes back with the score AND
// the reasons that produced it, and the frontend shows those reasons.
//
// Score is out of 100, from four signals:
//
//   Skill match     40  does the helper list this category as a skill?
//   Distance        25  closer is better, linear falloff to 5 km
//   Reliability     20  their average review rating
//   Availability    15  fewer open commitments = more likely to say yes
//
// Nothing here is machine learning. If asked in an interview, say exactly
// that: it is a weighted scoring function, which is the honest description.

const { distanceKm } = require('./geo');

const WEIGHTS = {
  skill: 40,
  distance: 25,
  reliability: 20,
  availability: 15,
};

const MAX_DISTANCE_KM = 5;

/**
 * Score one candidate helper against one request.
 * @returns {{score: number, reasons: string[], distance_km: number|null}}
 */
function scoreHelper(request, helper) {
  const reasons = [];
  let score = 0;

  // 1. Skill match ---------------------------------------------------------
  const skillIds = helper.skill_ids || [];
  if (skillIds.includes(request.category_id)) {
    score += WEIGHTS.skill;
    reasons.push(`Lists ${request.category_name} as a skill`);
  } else {
    reasons.push(`Does not list ${request.category_name}, but is nearby`);
  }

  // 2. Distance ------------------------------------------------------------
  const km = distanceKm(
    request.latitude,
    request.longitude,
    helper.latitude,
    helper.longitude
  );

  if (km !== null) {
    // 0 km scores full marks, MAX_DISTANCE_KM or beyond scores nothing.
    const closeness = Math.max(0, 1 - km / MAX_DISTANCE_KM);
    score += WEIGHTS.distance * closeness;

    if (km < 1) {
      reasons.push(`Only ${Math.round(km * 1000)} m away`);
    } else {
      reasons.push(`${km.toFixed(1)} km away`);
    }
  }

  // 3. Reliability ---------------------------------------------------------
  // avg_rating is null for someone with no reviews yet. We give them a
  // neutral 3.5 rather than 0, so new users are not permanently buried.
  const rating = helper.avg_rating === null ? 3.5 : Number(helper.avg_rating);
  score += WEIGHTS.reliability * ((rating - 1) / 4); // map 1..5 onto 0..1

  if (helper.review_count > 0) {
    reasons.push(`Rated ${rating.toFixed(1)} from ${helper.review_count} review${helper.review_count === 1 ? '' : 's'}`);
  } else {
    reasons.push('New helper, no reviews yet');
  }

  // 4. Availability --------------------------------------------------------
  // Someone already committed to 3+ open jobs is less likely to have time.
  const open = helper.open_commitments || 0;
  const availability = Math.max(0, 1 - open / 3);
  score += WEIGHTS.availability * availability;

  if (open === 0) {
    reasons.push('No other open commitments');
  } else {
    reasons.push(`Currently helping with ${open} other request${open === 1 ? '' : 's'}`);
  }

  return {
    score: Math.round(score),
    reasons,
    distance_km: km === null ? null : Number(km.toFixed(2)),
  };
}

/**
 * Rank every candidate for a request, best first.
 * @param {number} limit how many matches to return
 */
function findMatches(request, candidates, limit = 5) {
  return candidates
    .map((helper) => {
      const { score, reasons, distance_km } = scoreHelper(request, helper);
      return {
        id: helper.id,
        name: helper.name,
        street: helper.street,
        bio: helper.bio,
        avg_rating: helper.avg_rating === null ? null : Number(helper.avg_rating),
        review_count: helper.review_count,
        score,
        reasons,
        distance_km,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { findMatches, scoreHelper, WEIGHTS, MAX_DISTANCE_KM };
