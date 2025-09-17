import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import RNFS from 'react-native-fs';
import CameraRoll from '@react-native-camera-roll/camera-roll';

const VIDEO_FOLDER = `${RNFS.ExternalStorageDirectoryPath}/Movies/MyCameraAppVideos`;

const ensureVideoFolder = async () => {
  const exists = await RNFS.exists(VIDEO_FOLDER);
  if (!exists) {
    await RNFS.mkdir(VIDEO_FOLDER);
  }
};

// Map user-friendly quality to VisionCamera constants
const qualityMap = {
  '480p': 'low', // 640x480
  '720p': 'medium', // 1280x720
  '1080p': 'high', // 1920x1080
};

export default function CameraComponent({ location, address }) {
  const device = useCameraDevice('back');
  const cameraRef = useRef(null);

  const [hasPermission, setHasPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [dateTime, setDateTime] = useState('');
  const [videoQuality, setVideoQuality] = useState('480p'); // default

  useEffect(() => {
    const requestPermissions = async () => {
      const cam = await Camera.getCameraPermissionStatus();
      const mic = await Camera.getMicrophonePermissionStatus();

      if (cam !== 'authorized') await Camera.requestCameraPermission();
      if (mic !== 'authorized') await Camera.requestMicrophonePermission();

      setHasPermission(true);
    };
    requestPermissions();
  }, []);

  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        const now = new Date();
        setDateTime(now.toLocaleString());
      }, 1000);
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const startRecording = async () => {
    if (!cameraRef.current) return;
    try {
      setIsRecording(true);
      await cameraRef.current.startRecording({
        flash: 'off',
        fileType: 'mp4',
        quality: qualityMap[videoQuality], // Correct quality mapping
        frameRate: 30,
        videoCodec: 'H264', // Better compression
        onRecordingFinished: async (video) => {
          let newPath = '';
          let fileSizeMB = 'Unknown';
          try {
            await ensureVideoFolder();
            newPath = `${VIDEO_FOLDER}/video_${Date.now()}.mp4`;
            await RNFS.copyFile(video.path, newPath);

            const stats = await RNFS.stat(newPath);
            fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

            await CameraRoll.save(newPath, { type: 'video' });

            Alert.alert(
              'Video Saved',
              `Saved to: ${newPath}\nSize: ${fileSizeMB} MB\nQuality: ${videoQuality}`
            );
            console.log('Video saved at:', newPath, 'Size:', fileSizeMB, 'MB', 'Quality:', videoQuality);
          } catch (err) {
            console.log('Error saving video:', err);
            Alert.alert(
              'Video Saved',
              `Saved to: ${newPath}\nSize: ${fileSizeMB} MB\nQuality: ${videoQuality}`
            );
          } finally {
            setIsRecording(false);
          }
        },
        onRecordingError: (error) => {
          console.error('Recording error:', error);
          setIsRecording(false);
          Alert.alert('Recording Error', error?.message || 'Unknown error');
        },
      });
    } catch (e) {
      console.log('startRecording error:', e);
      setIsRecording(false);
      Alert.alert('Recording Error', e?.message || 'Unknown error');
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current) return;
    await cameraRef.current.stopRecording();
    setIsRecording(false);
  };

  if (!device || !hasPermission) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B6B" />
          <Text style={styles.loadingText}>Loading Camera...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <Camera
          style={StyleSheet.absoluteFill}
          ref={cameraRef}
          device={device}
          isActive={true}
          video={true}
          audio={true}
        />

        {isRecording && (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>{dateTime}</Text>
            {address && (
              <Text style={styles.overlayText}>
                Address: {address}
              </Text>
            )}
            {location && (
              <Text style={styles.overlayText}>
                Lat: {location.coords.latitude.toFixed(6)}, Lon: {location.coords.longitude.toFixed(6)}
              </Text>
            )}
          </View>
        )}

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.recordButton, isRecording && styles.recording]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Text style={styles.recordText}>
              {isRecording ? 'Stop' : 'Record'}
            </Text>
          </TouchableOpacity>

          <View style={styles.qualityContainer}>
            {['480p', '720p', '1080p'].map((q) => (
              <TouchableOpacity
                key={q}
                style={[
                  styles.qualityButton,
                  videoQuality === q && styles.qualitySelected,
                ]}
                onPress={() => setVideoQuality(q)}
              >
                <Text style={styles.qualityText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: { color: '#FFF', marginTop: 10, fontSize: hp('1.7%') },
  overlay: {
    position: 'absolute',
    bottom: hp('22%'),
    left: wp('3%'),
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 6,
    maxWidth: wp('95%'),
  },
  overlayText: { color: '#FFF', fontSize: hp('1.7%'), fontWeight: '600' },
  controls: {
    position: 'absolute',
    bottom: hp('5%'),
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    width: wp('20%'),
    height: wp('20%'),
    borderRadius: wp('12.5%'),
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  recording: { backgroundColor: '#D62828' },
  recordText: { color: '#FFF', fontSize: hp('2.2%'), fontWeight: 'bold' },
  qualityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: wp('60%'),
  },
  qualityButton: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  qualitySelected: { backgroundColor: '#FF6B6B' },
  qualityText: { color: '#FFF', fontWeight: '600' },
});
