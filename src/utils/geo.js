// Haversine formula: Calculates distance in meters between two GPS points
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Request customer GPS location and verify if within restaurant radius (Ultra-Fast 0.3s Non-Blocking)
export function verifyCustomerLocation(targetLat, targetLng, maxRadiusMeters = 500) {
  return new Promise((resolve) => {
    // If target restaurant coordinates are not configured or invalid, default to allowed instantly
    if (!targetLat || !targetLng || isNaN(targetLat) || isNaN(targetLng) || !navigator.geolocation) {
      return resolve({ allowed: true, distanceMeters: 0 });
    }

    let resolved = false;

    // Safety Timeout: Never block table order for more than 1.5 seconds!
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log('⚡ Location check fast-passed (timeout safety guard triggered for instant order)');
        resolve({ allowed: true, distanceMeters: 0 });
      }
    }, 1500);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);

        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const distanceMeters = getDistanceMeters(userLat, userLng, Number(targetLat), Number(targetLng));

        // Allow if distance is within radius
        if (distanceMeters <= (maxRadiusMeters || 500)) {
          resolve({ allowed: true, distanceMeters });
        } else {
          resolve({
            allowed: false,
            reason: 'outside_radius',
            distanceMeters,
            message: `Aap restaurant se ${distanceMeters > 1000 ? (distanceMeters / 1000).toFixed(1) + ' km' : distanceMeters + ' meters'} door hain. Table order sirf restaurant ke andar se ho sakta hai.`
          });
        }
      },
      (error) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);

        // On error (permission blocked or indoor signal loss), allow real dining guests to place their order instantly!
        console.warn('GPS location check error/denied -> Instant order fallback allowed:', error);
        resolve({ allowed: true, distanceMeters: 0 });
      },
      {
        enableHighAccuracy: false, // Fast Cellular/Wi-Fi positioning (0.1s response)
        timeout: 1400,
        maximumAge: 300000 // Cache position for 5 minutes for instant response
      }
    );
  });
}
