function parseCoordinate(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function parseCoordinates(latitude, longitude) {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);

  if (lat === null || lng === null) {
    return null;
  }

  return {
    latitude: lat,
    longitude: lng,
  };
}

function calculateDistanceKm(origin, destination) {
  if (!origin || !destination) {
    return null;
  }

  const earthRadiusKm = 6371;
  const latitudeDelta = ((destination.latitude - origin.latitude) * Math.PI) / 180;
  const longitudeDelta = ((destination.longitude - origin.longitude) * Math.PI) / 180;
  const originLatitude = (origin.latitude * Math.PI) / 180;
  const destinationLatitude = (destination.latitude * Math.PI) / 180;
  const haversineValue =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  const angularDistance =
    2 * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue));

  return earthRadiusKm * angularDistance;
}

function formatDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm)) {
    return "";
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }

  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km away`;
}

function buildOpenStreetMapEmbedUrl(coordinates, options = {}) {
  if (!coordinates) {
    return "";
  }

  const latitude = Number(coordinates.latitude);
  const longitude = Number(coordinates.longitude);
  const delta = options.delta || 0.02;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ]
    .map((value) => value.toFixed(6))
    .join("%2C");

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude.toFixed(6)}%2C${longitude.toFixed(6)}`;
}

function buildDirectionsUrl(origin, destination) {
  if (!origin || !destination) {
    return "";
  }

  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origin.latitude.toFixed(6)}%2C${origin.longitude.toFixed(6)}%3B${destination.latitude.toFixed(6)}%2C${destination.longitude.toFixed(6)}`;
}

export {
  buildDirectionsUrl,
  buildOpenStreetMapEmbedUrl,
  calculateDistanceKm,
  formatDistanceKm,
  parseCoordinates,
};
