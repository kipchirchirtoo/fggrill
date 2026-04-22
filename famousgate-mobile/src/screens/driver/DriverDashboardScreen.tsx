/**
 * DriverDashboardScreen
 * 
 * Driver enters dispatch code to start delivery
 * GPS tracking enabled for central store monitoring
 * Real-time location updates during transit
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Text, TextInput, ActivityIndicator, Button, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';
import { useAuthStore } from '../../stores/auth.store';

interface Props {
  navigation: any;
}

interface ActiveDispatch {
  id: string;
  dispatch_number: string;
  to_branch: { name: string; address?: string };
  items: any[];
  status: string;
  driver_otp?: string;
}

const DriverDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  
  // Dispatch Code Entry
  const [dispatchCode, setDispatchCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeDispatch, setActiveDispatch] = useState<ActiveDispatch | null>(null);
  
  // GPS Tracking
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  
  // Stats
  const [todayDeliveries, setTodayDeliveries] = useState(0);
  const [pendingDeliveries, setPendingDeliveries] = useState(0);

  useEffect(() => {
    checkLocationPermission();
    loadDriverStats();
    
    return () => {
      stopTracking();
    };
  }, []);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermission(status);
      
      if (status === 'granted') {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCurrentLocation(location);
        } catch (locError) {
          console.log('⚠️ Could not get current location (may be unavailable on emulator)');
          // Don't show error to user - location services may not be available on emulator
        }
      }
    } catch (error) {
      console.error('Error checking location permission:', error);
      // Set permission to denied so UI shows the request button
      setLocationPermission('denied');
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      
      if (status === 'granted') {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCurrentLocation(location);
          Alert.alert('Success', 'Location permission granted');
        } catch (locError) {
          console.log('⚠️ Location permission granted but location unavailable (emulator?)');
          Alert.alert(
            'Location Unavailable',
            'Location permission granted but GPS location is not available. This is normal on emulators.',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          'Permission Denied',
          'Location permission is required for GPS tracking during deliveries.',
          [
            { text: 'Cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      Alert.alert('Error', 'Failed to request location permission');
    }
  };

  const startTracking = async () => {
    if (locationPermission !== 'granted') {
      Alert.alert('Permission Required', 'Please grant location permission to start tracking');
      return;
    }

    try {
      setIsTracking(true);
      
      // Start location tracking with high accuracy
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 50, // Or every 50 meters
        },
        (location) => {
          setCurrentLocation(location);
          sendLocationUpdate(location);
        }
      );
      
      Alert.alert('Tracking Started', 'Your location is now being tracked');
    } catch (error: any) {
      console.error('Error starting tracking:', error);
      setIsTracking(false);
      
      // Check if it's an emulator/unavailable location issue
      if (error.message?.includes('unavailable') || error.message?.includes('Location')) {
        Alert.alert(
          'Location Unavailable',
          'GPS tracking is not available. This is normal on emulators. On a real device, ensure location services are enabled.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to start GPS tracking');
      }
    }
  };

  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setIsTracking(false);
  };

  const sendLocationUpdate = async (location: Location.LocationObject) => {
    if (!activeDispatch) return;
    
    try {
      // Send location to backend for tracking
      await dispatchApi.updateDispatchLocation(activeDispatch.id, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: new Date(location.timestamp).toISOString(),
      });
    } catch (error) {
      console.error('Error sending location update:', error);
    }
  };

  const loadDriverStats = async () => {
    try {
      const dispatches = await dispatchApi.getDispatches({ driver_id: user?.id });
      const today = new Date().toDateString();
      
      const todayCount = dispatches.filter((d: any) => 
        new Date(d.created_at).toDateString() === today && d.status === 'completed'
      ).length;
      
      const pendingCount = dispatches.filter((d: any) => 
        d.status === 'pending' || d.status === 'in_transit'
      ).length;
      
      setTodayDeliveries(todayCount);
      setPendingDeliveries(pendingCount);
    } catch (error: any) {
      console.error('Error loading driver stats:', error);
      // Gracefully handle authorization errors - stats will show 0
      if (error.response?.status === 403) {
        console.log('⚠️ Driver not authorized to view stats yet. Backend may need restart.');
      }
    }
  };

  const handleStartDelivery = async () => {
    if (!dispatchCode.trim()) {
      Alert.alert('Required', 'Please enter dispatch code');
      return;
    }

    setIsLoading(true);
    try {
      // Search for dispatch by code
      const dispatches = await dispatchApi.getDispatches();
      const dispatch = dispatches.find((d: any) => 
        d.dispatch_number === dispatchCode.trim().toUpperCase()
      );

      if (!dispatch) {
        Alert.alert('Not Found', 'Dispatch code not found');
        return;
      }

      if (dispatch.status !== 'pending') {
        Alert.alert('Invalid Status', `This dispatch is already ${dispatch.status}`);
        return;
      }

      // Validate dispatch has required data
      if (!dispatch.to_branch) {
        Alert.alert('Invalid Dispatch', 'Dispatch is missing destination branch information');
        return;
      }

      // Verify driver OTP if exists
      if (dispatch.driver_otp) {
        navigation.navigate('VerifyDriverOTP', { dispatch });
      } else {
        // Start delivery directly
        setActiveDispatch(dispatch);
        startTracking();
        Alert.alert(
          'Delivery Started',
          `Delivering to ${dispatch.to_branch?.name || 'destination'}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Error starting delivery:', error);
      if (error.response?.status === 403) {
        Alert.alert(
          'Authorization Error',
          'You do not have permission to access dispatches. Please contact your administrator or restart the backend server.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to start delivery');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteDelivery = () => {
    if (!activeDispatch) return;
    
    stopTracking();
    navigation.navigate('CompleteDelivery', { dispatch: activeDispatch });
  };

  const openMaps = () => {
    if (!activeDispatch?.to_branch?.address) {
      Alert.alert('No Address', 'Destination address not available');
      return;
    }

    const address = encodeURIComponent(activeDispatch.to_branch.address);
    const url = Platform.select({
      ios: `maps://app?daddr=${address}`,
      android: `google.navigation:q=${address}`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open maps');
      });
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Stop tracking if active
              if (isTracking) {
                stopTracking();
              }
              await logout();
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Hello, {user?.first_name || 'Driver'}!</Text>
          <Text style={styles.subtitle}>Ready for deliveries</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
          >
            <MaterialCommunityIcons name="logout" size={24} color={colors.danger.DEFAULT} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <MaterialCommunityIcons name="account-circle" size={40} color={colors.primary.DEFAULT} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.success.DEFAULT + '15' }]}>
          <MaterialCommunityIcons name="check-circle" size={32} color={colors.success.DEFAULT} />
          <Text style={styles.statValue}>{todayDeliveries}</Text>
          <Text style={styles.statLabel}>Today's Deliveries</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.warning.DEFAULT + '15' }]}>
          <MaterialCommunityIcons name="clock-outline" size={32} color={colors.warning.DEFAULT} />
          <Text style={styles.statValue}>{pendingDeliveries}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* GPS Status Card */}
      <Card style={styles.gpsCard}>
        <Card.Content>
          <View style={styles.gpsHeader}>
            <MaterialCommunityIcons 
              name={isTracking ? "map-marker-check" : "map-marker-off"} 
              size={24} 
              color={isTracking ? colors.success.DEFAULT : colors.text.tertiary} 
            />
            <Text style={styles.gpsTitle}>GPS Tracking</Text>
            {isTracking && (
              <View style={styles.trackingBadge}>
                <View style={styles.trackingDot} />
                <Text style={styles.trackingText}>Active</Text>
              </View>
            )}
          </View>
          
          {locationPermission === 'granted' ? (
            <>
              {currentLocation && (
                <View style={styles.locationInfo}>
                  <Text style={styles.locationText}>
                    📍 Lat: {currentLocation.coords.latitude.toFixed(6)}
                  </Text>
                  <Text style={styles.locationText}>
                    📍 Lng: {currentLocation.coords.longitude.toFixed(6)}
                  </Text>
                  <Text style={styles.locationText}>
                    🎯 Accuracy: ±{currentLocation.coords.accuracy?.toFixed(0)}m
                  </Text>
                </View>
              )}
              {isTracking && (
                <Text style={styles.trackingNote}>
                  ✓ Central store is monitoring your location
                </Text>
              )}
            </>
          ) : (
            <View style={styles.permissionPrompt}>
              <Text style={styles.permissionText}>
                Location permission required for GPS tracking
              </Text>
              <Button
                mode="contained"
                onPress={requestLocationPermission}
                style={styles.permissionBtn}
              >
                Grant Permission
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Active Delivery */}
      {activeDispatch ? (
        <Card style={styles.activeCard}>
          <Card.Content>
            <View style={styles.activeHeader}>
              <MaterialCommunityIcons name="truck-fast" size={28} color={colors.primary.DEFAULT} />
              <Text style={styles.activeTitle}>Active Delivery</Text>
            </View>
            
            <View style={styles.activeInfo}>
              <Text style={styles.dispatchNumber}>{activeDispatch.dispatch_number}</Text>
              <Text style={styles.destination}>
                → {activeDispatch.to_branch?.name || 'Unknown Branch'}
              </Text>
              <Text style={styles.itemCount}>
                {activeDispatch.items?.length || 0} items
              </Text>
            </View>

            <View style={styles.activeActions}>
              <Button
                mode="outlined"
                onPress={openMaps}
                style={styles.actionBtn}
                icon="map-marker"
              >
                Open Maps
              </Button>
              <Button
                mode="contained"
                onPress={handleCompleteDelivery}
                style={styles.actionBtn}
                buttonColor={colors.success.DEFAULT}
              >
                Complete Delivery
              </Button>
            </View>
          </Card.Content>
        </Card>
      ) : (
        /* Start Delivery Card */
        <Card style={styles.startCard}>
          <Card.Content>
            <View style={styles.startHeader}>
              <MaterialCommunityIcons name="barcode-scan" size={32} color={colors.primary.DEFAULT} />
              <Text style={styles.startTitle}>Start Delivery</Text>
            </View>
            
            <Text style={styles.startSubtitle}>
              Enter the dispatch code to begin
            </Text>

            <TextInput
              value={dispatchCode}
              onChangeText={setDispatchCode}
              placeholder="e.g., DISP-202604-0001"
              mode="outlined"
              style={styles.codeInput}
              autoCapitalize="characters"
              autoCorrect={false}
              left={<TextInput.Icon icon="barcode" />}
              right={
                dispatchCode ? (
                  <TextInput.Icon 
                    icon="close-circle" 
                    onPress={() => setDispatchCode('')}
                  />
                ) : undefined
              }
            />

            <Button
              mode="contained"
              onPress={handleStartDelivery}
              loading={isLoading}
              disabled={isLoading || !dispatchCode.trim()}
              style={styles.startBtn}
              icon="truck-delivery"
            >
              Start Delivery
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('DeliveryHistory')}
        >
          <MaterialCommunityIcons name="history" size={24} color={colors.primary.DEFAULT} />
          <Text style={styles.quickActionText}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('Profile')}
        >
          <MaterialCommunityIcons name="account" size={24} color={colors.primary.DEFAULT} />
          <Text style={styles.quickActionText}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('Settings')}
        >
          <MaterialCommunityIcons name="cog" size={24} color={colors.primary.DEFAULT} />
          <Text style={styles.quickActionText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.DEFAULT,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoutBtn: {
    padding: spacing.sm,
  },
  profileBtn: {
    padding: spacing.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  gpsCard: {
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  gpsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  gpsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  trackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.success.DEFAULT + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success.DEFAULT,
  },
  trackingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success.DEFAULT,
  },
  locationInfo: {
    backgroundColor: colors.background.DEFAULT,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  locationText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  trackingNote: {
    fontSize: 12,
    color: colors.success.DEFAULT,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  permissionPrompt: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  permissionText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  permissionBtn: {
    marginTop: spacing.sm,
  },
  activeCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.primary.DEFAULT + '10',
    ...shadows.md,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  activeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  activeInfo: {
    marginBottom: spacing.lg,
  },
  dispatchNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary.DEFAULT,
    marginBottom: spacing.sm,
  },
  destination: {
    fontSize: 15,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  itemCount: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  activeActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  startCard: {
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  startHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  startTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  startSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  codeInput: {
    marginBottom: spacing.lg,
  },
  startBtn: {
    paddingVertical: spacing.sm,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
  },
  quickAction: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  quickActionText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
});

export default DriverDashboardScreen;
