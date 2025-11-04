import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
} from "react-native";
import { Camera, useCameraDevice } from "react-native-vision-camera";
import RNFS from "react-native-fs";
import { Video } from "react-native-compressor";
import CameraRoll from "@react-native-camera-roll/camera-roll";
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from "react-native-responsive-screen";

const qualityMap = {
  "480p": { label: "480p", maxSize: 480 },
  "720p": { label: "720p", maxSize: 720 },
  "1080p": { label: "1080p", maxSize: 1080 },
};

export default function CameraComponent({ address }) {
  const camera = useRef(null);
  const device = useCameraDevice("back");
  const [recording, setRecording] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedQuality, setSelectedQuality] = useState("720p");
  const [videoCount, setVideoCount] = useState(0);
  const [dateTime, setDateTime] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [blink, setBlink] = useState(true);

  const VIDEO_FOLDER = `${RNFS.CachesDirectoryPath}/videos`;

  // Initial setup: permissions + folder
  useEffect(() => {
    (async () => {
      await Camera.requestCameraPermission();
      await Camera.requestMicrophonePermission();

      if (Platform.OS === "android") {
        if (Platform.Version >= 33) {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO);
        } else {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        }
      }

      if (!(await RNFS.exists(VIDEO_FOLDER))) {
        await RNFS.mkdir(VIDEO_FOLDER);
      }
    })();
  }, []);

  // Timer effect (no auto-stop)
  useEffect(() => {
    let interval;
    if (recording) {
      setElapsedTime(0);
      interval = setInterval(() => setElapsedTime((prev) => prev + 1), 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [recording]);

  // Blinking red dot
  useEffect(() => {
    let blinkInterval;
    if (recording) {
      blinkInterval = setInterval(() => setBlink((prev) => !prev), 500);
    }
    return () => clearInterval(blinkInterval);
  }, [recording]);

  // Date-time overlay
  useEffect(() => {
    let timer;
    if (recording) {
      timer = setInterval(() => {
        const now = new Date();
        setDateTime(now.toLocaleString());
      }, 1000);
    } else {
      setDateTime("");
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [recording]);

  const formatTime = (seconds) => {
    const min = String(Math.floor(seconds / 60)).padStart(2, "0");
    const sec = String(seconds % 60).padStart(2, "0");
    return `${min}:${sec}`;
  };

  const startRecording = async () => {
    if (!camera.current) return;
    setRecording(true);

    camera.current.startRecording({
      onRecordingFinished: (video) => {
        setRecording(false);
        handleCompression(video.path);
        setVideoCount((prev) => prev + 1);
      },
      onRecordingError: (err) => {
        console.error("Recording failed:", err);
        setRecording(false);
      },
    });
  };

  const stopRecording = async () => {
    if (!camera.current) return;
    await camera.current.stopRecording();
  };

  const handleCompression = async (path) => {
    try {
      setCompressing(true);
      setProgress(0);
      const settings = qualityMap[selectedQuality];

      const compressedPath = await Video.compress(
        "file://" + path,
        {
          compressionMethod: "auto",
          maxSize: settings.maxSize,
          fps: 15,
          removeAudio: false,
          minimumBitrate: 500000,
        },
        (p) => setProgress(Math.floor(p * 100))
      );

      const compStats = await RNFS.stat(compressedPath);
      console.log("Compressed size:", (compStats.size / (1024 * 1024)).toFixed(2), "MB");

      if (Platform.OS === "android") {
        if (Platform.Version >= 33) {
          // Android 13+
          try {
            await CameraRoll.save(compressedPath, { type: "video" });
          } catch (e) {
            const destPath = `${RNFS.ExternalStorageDirectoryPath}/DCIM/Camera/vid_${Date.now()}.mp4`;
            await RNFS.copyFile(compressedPath, destPath);
            Alert.alert("Success", `Video saved in ${settings.label}`);
          }
        } else {
          // Android 11-12
          const destPath = `${RNFS.ExternalStorageDirectoryPath}/DCIM/Camera/vid_${Date.now()}.mp4`;
          await RNFS.copyFile(compressedPath, destPath);
          Alert.alert("Success", `Video saved to DCIM/Camera`);
        }
      } else {
        // iOS
        await CameraRoll.save(compressedPath, { type: "video" });
        Alert.alert("Success", `Video saved in ${settings.label}`);
      }
    } catch (err) {
      console.error("Compression failed:", err);
      Alert.alert("Error", err?.message || "Video compression failed");
    } finally {
      setCompressing(false);
    }
  };

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#FFF", fontSize: hp("2%") }}>No camera found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera ref={camera} style={StyleSheet.absoluteFill} device={device} isActive={true} video={true} audio={true} />

      {/* Quality Selector */}
      <View style={styles.qualityContainer}>
        {Object.keys(qualityMap).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.qualityButton, selectedQuality === key && styles.qualitySelected]}
            onPress={() => setSelectedQuality(key)}
          >
            <Text style={styles.qualityText}>{qualityMap[key].label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Timer + Red Dot + Date + Address */}
      {recording && (
        <View style={styles.overlayInfo}>
          <View style={styles.timerRow}>
            {blink && <View style={styles.redDot} />}
            <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
          </View>
          <Text style={styles.overlayText}>{dateTime}</Text>
          {address && <Text style={styles.overlayText}>Address: {address}</Text>}
        </View>
      )}

      {/* Record Button */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.recordButton, recording && styles.recording, compressing && styles.disabledButton]}
          onPress={recording ? stopRecording : startRecording}
          disabled={compressing}
        >
          <Text style={styles.recordText}>{recording ? "Stop" : "Record"}</Text>
        </TouchableOpacity>
      </View>

      {/* Compression Overlay */}
      {compressing && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.overlayText1}>
            Compressing ({selectedQuality}): {progress}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
  overlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -wp("47.5%") }, { translateY: -hp("5%") }],
    width: wp("95%"),
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: wp("3%"),
    borderRadius: 10,
    alignItems: "center",
  },
  overlayInfo: {
    position: "absolute",
    bottom: hp("15%"),
    left: wp("5%"),
    right: wp("5%"),
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: wp("2%"),
    borderRadius: 10,
    alignItems: "center",
  },
  overlayText: { color: "#FFF", fontSize: hp("1.7%"), fontWeight: "600" },
  overlayText1: { color: "#FFF", fontSize: hp("1.8%"), fontWeight: "600", marginTop: hp("1%") },
  controls: { position: "absolute", bottom: hp("5%"), left: 0, right: 0, justifyContent: "center", alignItems: "center" },
  recordButton: { width: wp("18%"), height: wp("18%"), borderRadius: wp("9%"), backgroundColor: "#FF6B6B", justifyContent: "center", alignItems: "center" },
  recording: { backgroundColor: "#D62828" },
  recordText: { color: "#FFF", fontSize: hp("2.2%"), fontWeight: "bold" },
  disabledButton: { opacity: 0.6 },
  qualityContainer: {
    position: "absolute",
    top: hp("5%"),
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: wp("2%"),
    borderRadius: 10,
    width: wp("70%"),
    alignItems: "center",
  },
  qualityButton: { paddingVertical: hp("0.5%"), paddingHorizontal: wp("3%"), borderRadius: 6, borderWidth: 1, borderColor: "#FFF" },
  qualitySelected: { backgroundColor: "#FF6B6B" },
  qualityText: { color: "#FFF", fontWeight: "600" },
  timerRow: { flexDirection: "row", alignItems: "center", marginBottom: hp("1%") },
  redDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "red", marginRight: wp("2%") },
  timerText: { color: "#FFF", fontSize: hp("2.2%"), fontWeight: "bold", letterSpacing: 1 },
});
