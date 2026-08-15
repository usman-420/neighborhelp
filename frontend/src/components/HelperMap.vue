<script setup>
// HelperMap.vue — Leaflet map of nearby neighbours.
//
// Two accessibility/privacy points worth knowing:
//  - Rating is shown by colour AND by the number inside the marker, so
//    the information does not depend on colour vision alone.
//  - The coordinates arriving from the API are already blurred by the
//    backend, so no exact home location is ever plotted.
import { ref, onMounted, onUnmounted, watch } from 'vue';
import L from 'leaflet';

const props = defineProps({
  users: { type: Array, default: () => [] },
});

const mapEl = ref(null);
let map = null;
let markerLayer = null;

function colourFor(rating) {
  if (rating === null || rating === undefined) return '#9ca3af'; // no reviews
  if (rating >= 4.5) return '#059669';
  if (rating >= 3.5) return '#d97706';
  return '#dc2626';
}

function draw() {
  if (!map) return;

  markerLayer.clearLayers();
  const points = [];

  for (const u of props.users) {
    if (u.latitude == null || u.longitude == null) continue;

    const label = u.avg_rating === null ? '–' : Number(u.avg_rating).toFixed(1);

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        background:${colourFor(u.avg_rating)};
        width:34px;height:34px;border-radius:50%;
        border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);
        color:#fff;font:700 11px system-ui;
        display:flex;align-items:center;justify-content:center;">${label}</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    L.marker([u.latitude, u.longitude], { icon })
      .bindPopup(
        `<strong>${u.name}</strong><br>` +
          `${u.street || 'Mechelen'}<br>` +
          `${u.avg_rating === null ? 'No reviews yet' : `Rated ${u.avg_rating} from ${u.review_count} review(s)`}<br>` +
          `${u.skills?.length ? u.skills.join(', ') : 'No skills listed'}`
      )
      .addTo(markerLayer);

    points.push([u.latitude, u.longitude]);
  }

  // Fit the view to the markers so they are never all stacked in one spot.
  if (points.length > 1) {
    map.fitBounds(L.latLngBounds(points).pad(0.25));
  } else if (points.length === 1) {
    map.setView(points[0], 14);
  }
}

onMounted(() => {
  map = L.map(mapEl.value).setView([51.0259, 4.4776], 13); // Mechelen

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
  draw();
});

// Redraw when the filtered user list changes.
watch(() => props.users, draw, { deep: true });

onUnmounted(() => {
  if (map) map.remove();
});
</script>

<template>
  <div ref="mapEl" class="map-holder"></div>
</template>
