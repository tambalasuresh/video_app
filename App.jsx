import React, { useEffect, useState } from "react";
import { Platform, PermissionsAndroid, View, Text, Alert, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Geolocation from "react-native-geolocation-service";
import CameraComponent from "./src/component/camera";

export async function getAddressFromLatLng(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
    const resp = await fetch(url, { headers: { "User-Agent": "MyReactNativeApp/1.0" } });
    const json = await resp.json();
    return json.display_name || "No address found";
  } catch (err) {
    console.error("Error fetching address:", err);
    return null;
  }
}

export default function App() {
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState("");

  const requestAllPermissions = async () => {
    try {
      // 1️⃣ Location
      let locationPermission = false;
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          { title: "Location Permission", message: "App needs location for stamping videos", buttonPositive: "OK" }
        );
        locationPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const auth = await Geolocation.requestAuthorization("whenInUse");
        locationPermission = auth === "granted";
      }

      // 2️⃣ Camera & Microphone
      const Camera = require("react-native-vision-camera").Camera;
      const cam = await Camera.requestCameraPermission();
      const cameraPermission = cam === "authorized" || cam === "granted";
      const mic = await Camera.requestMicrophonePermission();
      const micPermission = mic === "authorized" || mic === "granted";

      let storagePermission = true;
      if (Platform.OS === "android") {
        if (Platform.Version >= 33) {
          // Android 13+
          const readVideos = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO);
          const readImages = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
          const readAudio = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
          storagePermission =
            readVideos === PermissionsAndroid.RESULTS.GRANTED &&
            readImages === PermissionsAndroid.RESULTS.GRANTED &&
            readAudio === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          // Android 11-12
          const write = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
          const read = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
          storagePermission =
            write === PermissionsAndroid.RESULTS.GRANTED &&
            read === PermissionsAndroid.RESULTS.GRANTED;
        }
      }

      console.log({ locationPermission, cameraPermission, micPermission, storagePermission });

      if (locationPermission && cameraPermission && micPermission && storagePermission) {
        setPermissionsGranted(true);
      } else {
        Alert.alert("Permissions required", "All permissions are required to use this app.");
        setPermissionsGranted(false);
      }
    } catch (err) {
      console.error("Permission error:", err);
      Alert.alert("Error", "Failed to request permissions.");
      setPermissionsGranted(false);
    }
  };

  useEffect(() => {
    requestAllPermissions();
  }, []);

  useEffect(() => {
    if (!permissionsGranted) return;

    const watchId = Geolocation.watchPosition(
      async (position) => {
        setLocation(position);
        const addr = await getAddressFromLatLng(position.coords.latitude, position.coords.longitude);
        setAddress(addr);
      },
      (error) => console.error("Location error:", error),
      { enableHighAccuracy: true, distanceFilter: 0, interval: 5000, fastestInterval: 2000 }
    );

    return () => watchId != null && Geolocation.clearWatch(watchId);
  }, [permissionsGranted]);

  if (!permissionsGranted) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={{ color: "#FFF", marginTop: 10 }}>Requesting permissions...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <CameraComponent location={location} address={address} />
    </SafeAreaProvider>
  );
}
