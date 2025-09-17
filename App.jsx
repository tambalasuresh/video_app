import React, { useEffect, useState } from 'react';
import { Platform, PermissionsAndroid, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Geolocation from 'react-native-geolocation-service';
import CameraComponent from './src/component/camera';

// Function to fetch address from lat/lng using Nominatim
export async function getAddressFromLatLng(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'MyReactNativeApp/1.0' // required by Nominatim
      }
    });
    const json = await resp.json();
    return json.display_name || 'No address found';
  } catch (err) {
    console.error('Error fetching address:', err);
    return null;
  }
}

export default function App() {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');

  // Ask for location permission
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location for stamping videos',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    } else {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      return auth === 'granted';
    }
  };

  useEffect(() => {
    const getLiveLocation = async () => {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        console.log('Location permission denied');
        return;
      }

      const watchId = Geolocation.watchPosition(
        async (position) => {
          setLocation(position);

          // Fetch address when new position arrives
          const { latitude, longitude } = position.coords;
          const addr = await getAddressFromLatLng(latitude, longitude);
          setAddress(addr);

          console.log('New position:', position);
          console.log('Address:', addr);
        },
        (error) => {
          console.log('Location error:', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 0,
          interval: 5000,
          fastestInterval: 2000,
        }
      );

      return () => {
        if (watchId != null) {
          Geolocation.clearWatch(watchId);
        }
      };
    };

    getLiveLocation();
  }, []);

  return (
    <SafeAreaProvider>
      {/* <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        {location ? (
          <>
            <Text>Latitude: {location.coords.latitude}</Text>
            <Text>Longitude: {location.coords.longitude}</Text>
            <Text>Address: {address}</Text>
          </>
        ) : (
          <Text>Fetching location...</Text>
        )}
      </View> */}

      <CameraComponent location={location} address={address} />
    </SafeAreaProvider>
  );
}
