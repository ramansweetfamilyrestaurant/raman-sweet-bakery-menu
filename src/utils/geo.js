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

// Request customer GPS location and verify if within restaurant radius
export function verifyCustomerLocation(targetLat, targetLng, maxRadiusMeters = 100) {
  return new Promise((resolve) => {
    // If target restaurant coordinates are not configured or invalid, default to allowed
    if (!targetLat || !targetLng || isNaN(targetLat) || isNaN(targetLng) || Number(targetLat) === 0 || Number(targetLng) === 0) {
      return resolve({ allowed: true, distanceMeters: 0, accuracy: null });
    }

    if (!navigator.geolocation) {
      return resolve({
        allowed: false,
        reason: 'no_geolocation',
        message: '📍 Your browser does not support GPS location. Please use a modern mobile browser (Chrome/Safari) to place table orders.'
      });
    }

    let resolved = false;
    let bestReading = null;
    let watchId = null;

    const finalize = (reading) => {
      if (resolved) return;
      resolved = true;
      if (watchId !== null) {
        try { navigator.geolocation.clearWatch(watchId); } catch {}
      }

      if (!reading || !reading.coords) {
        return resolve({
          allowed: false,
          reason: 'location_unavailable',
          message: '📍 Location Access Required: Please enable GPS / Location permissions in your browser to verify you are inside the restaurant.'
        });
      }

      const userLat = reading.coords.latitude;
      const userLng = reading.coords.longitude;
      const accuracy = Math.round(reading.coords.accuracy || 999);
      const rawDistance = getDistanceMeters(userLat, userLng, Number(targetLat), Number(targetLng));

      // Tight buffer tolerance: max 30m to prevent false positives while allowing minor indoor drift
      const accuracyBuffer = Math.min(accuracy * 0.3, 30);
      const effectiveDistance = Math.max(0, rawDistance - accuracyBuffer);
      const radius = Number(maxRadiusMeters) || 100;

      if (effectiveDistance <= radius) {
        resolve({
          allowed: true,
          distanceMeters: rawDistance,
          effectiveDistance,
          accuracy,
          customerLat: userLat,
          customerLng: userLng
        });
      } else {
        const displayDist = rawDistance > 1000 ? `${(rawDistance / 1000).toFixed(1)} km` : `${rawDistance} meters`;
        resolve({
          allowed: false,
          reason: 'outside_radius',
          distanceMeters: rawDistance,
          accuracy,
          customerLat: userLat,
          customerLng: userLng,
          message: `📍 Order Rejected: Aap restaurant se ${displayDist} door hain (Allowed radius: ${radius}m). Table order sirf restaurant ke dining area ke andar se ho sakta hai.`
        });
      }
    };

    // Safety Timeout: 5 seconds max for GPS fix
    const timer = setTimeout(() => {
      finalize(bestReading);
    }, 5000);

    // Progressive High Accuracy GPS fix
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        bestReading = pos;
        if (pos.coords.accuracy && pos.coords.accuracy <= 25) {
          clearTimeout(timer);
          finalize(pos);
          return;
        }

        // Refine lock for up to 3 seconds if first reading was coarse
        const startTime = Date.now();
        watchId = navigator.geolocation.watchPosition(
          (watchPos) => {
            if (!bestReading || (watchPos.coords.accuracy && watchPos.coords.accuracy < bestReading.coords.accuracy)) {
              bestReading = watchPos;
            }
            if ((watchPos.coords.accuracy && watchPos.coords.accuracy <= 15) || (Date.now() - startTime >= 3000)) {
              clearTimeout(timer);
              finalize(bestReading);
            }
          },
          () => {
            clearTimeout(timer);
            finalize(bestReading);
          },
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
        );
      },
      (error) => {
        console.warn('Customer GPS check error:', error);
        clearTimeout(timer);
        finalize(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 4500,
        maximumAge: 0
      }
    );
  });
}
