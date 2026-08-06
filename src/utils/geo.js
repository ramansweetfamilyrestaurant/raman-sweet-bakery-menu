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
    // Check if Geolocation API supported
    if (!navigator.geolocation) {
      return resolve({
        allowed: false,
        reason: 'unsupported',
        message: 'Your browser does not support GPS location verification.'
      });
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        // If target restaurant coordinates are not configured, default to allowed
        if (!targetLat || !targetLng) {
          return resolve({ allowed: true, distanceMeters: 0 });
        }

        const distanceMeters = getDistanceMeters(userLat, userLng, Number(targetLat), Number(targetLng));

        if (distanceMeters <= maxRadiusMeters) {
          resolve({ allowed: true, distanceMeters });
        } else {
          resolve({
            allowed: false,
            reason: 'outside_radius',
            distanceMeters,
            message: `Aap restaurant se ${distanceMeters > 1000 ? (distanceMeters/1000).toFixed(1) + ' km' : distanceMeters + ' meters'} door hain. Table order sirf restaurant ke andar se ho sakta hai.`
          });
        }
      },
      (error) => {
        let errorMsg = 'Please turn ON GPS Location on your device to place a table order.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission is denied. Please allow location access in your browser settings to place a table order.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Unable to determine your GPS location. Please check if your phone GPS is turned ON.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'GPS location request timed out. Please try again.';
        }

        resolve({
          allowed: false,
          reason: 'location_error',
          code: error.code,
          message: errorMsg
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}
