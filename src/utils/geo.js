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

    // Progressive GPS fix with 25-second user response window
    const primaryOptions = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    };

    const fallbackOptions = {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 30000
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        finalize(pos);
      },
      (err) => {
        console.warn('Primary GPS attempt failed or timed out:', err);

        if (err.code === 1) {
          // Permission Denied by user
          return resolve({
            allowed: false,
            reason: 'permission_denied',
            message: '📍 Location Permission Blocked:\n\n1. Browser address bar me 🔒 Lock icon par tap karein.\n2. Permissions ➔ Location ko "Allow" karein.\n3. Dobara "Place Order" dabayein.'
          });
        }

        // If timeout or position unavailable, attempt fallback network positioning
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            finalize(fallbackPos);
          },
          (fallbackErr) => {
            if (fallbackErr.code === 1) {
              resolve({
                allowed: false,
                reason: 'permission_denied',
                message: '📍 Location Permission Blocked:\n\n1. Browser address bar me 🔒 Lock icon par tap karein.\n2. Permissions ➔ Location ko "Allow" karein.\n3. Dobara "Place Order" dabayein.'
              });
            } else {
              resolve({
                allowed: false,
                reason: 'location_unavailable',
                message: '📍 Location is Turned OFF:\n\nApne phone ke top notification bar se Location (GPS) ON karein aur dobara "Place Order" dabayein.'
              });
            }
          },
          fallbackOptions
        );
      },
      primaryOptions
    );
  });
}
