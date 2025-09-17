import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import Geocoder from 'react-native-geocoding';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

// Initialize Geocoder with your Google Maps API Key
Geocoder.init('YOUR_GOOGLE_MAPS_API_KEY'); 

const MainPage = () => {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');

  const requestLocationPermission = async () => {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  useEffect(() => {
    const getLiveLocation = async () => {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return;

      const watchId = Geolocation.watchPosition(
        async (position) => {
          setLocation(position);

          // Reverse Geocode: convert lat/lng to address
          try {
            const geo = await Geocoder.from(position.coords.latitude, position.coords.longitude);
            if (geo.results.length > 0) {
              setAddress(geo.results[0].formatted_address);
            }
          } catch (err) {
            console.log("Geocoding error:", err);
          }
        },
        (error) => {
          console.log("Location error:", error);
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
    <View style={styles.container}>
      {location && (
        <View style={{ marginTop: hp('2%') }}>
          <Text style={styles.uriText}>📍 Location</Text>
          <Text style={styles.uriText}>
            Lat: {location.coords.latitude.toFixed(6)}
          </Text>
          <Text style={styles.uriText}>
            Lng: {location.coords.longitude.toFixed(6)}
          </Text>
          {address !== '' && (
            <Text style={[styles.uriText, { marginTop: hp('1%') }]}>
              🏠 Address: {address}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1, // fills the parent
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: wp('2%'),
    backgroundColor: '#f0f0f0', // optional: make it visible
  },
  uriText: {
    fontSize: hp('2%'),
    color: '#000',
  },
});
export default MainPage;
