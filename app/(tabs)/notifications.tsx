import {
  Carattere_400Regular,
  useFonts,
} from '@expo-google-fonts/carattere';
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { io, Socket } from 'socket.io-client';
import { useThemeStyles } from '../../hooks/useThemeStyles';
import { useAuth } from '../context/AuthContext';

// Types for notifications
interface NotificationUser {
  _id: string;
  name: string;
  username: string;
  profilePicture?: string;
}

interface Notification {
  _id: string;
  type: "friend_request" | "post_like" | "post_comment" | "friend_request_accepted" | "post_share" | "mention";
  sender?: NotificationUser;
  senderId?: string;
  recipientId: string;
  message: string;
  postId?: string;
  isRead: boolean;
  createdAt: string;
  metadata?: any;
}

const makeApiCall = async (url: string, options: { method: string; body?: any; getAuthHeaders: () => Promise<any> }) => {
  try {
    console.log(`🌐 Making ${options.method} request to:`, url);
    
    const authHeaders = await options.getAuthHeaders();
    const headers = {
      ...authHeaders,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    console.log(`📨 Response status: ${response.status} for ${url}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error ${response.status}:`, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response;
  } catch (error) {
    console.error('❌ Network error:', error);
    throw error;
  }
};

export default function NotificationsScreen() {
  const { colors } = useThemeStyles();
  const { user, getAuthHeaders } = useAuth();
  const styles = createStyles(colors);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  
  const socketRef = useRef<Socket | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load Carattere font
  let [fontsLoaded] = useFonts({
    Carattere_400Regular,
  });

  // Get token from auth headers
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const authHeaders = await getAuthHeaders();
      
      // Type assertion to safely access properties
      const headers = authHeaders as Record<string, string>;
      
      // Find authorization header (case insensitive)
      const authKey = Object.keys(headers).find(
        key => key.toLowerCase() === 'authorization'
      );
      
      const authHeader = authKey ? headers[authKey] : null;
      
      if (!authHeader) {
        console.log('No Authorization header found. Available headers:', Object.keys(headers));
        return null;
      }

      // Extract token from "Bearer <token>"
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      
      if (!token) {
        console.log('Empty token found in Authorization header');
        return null;
      }
      
      console.log('✅ Token extracted successfully');
      return token;
    } catch (error) {
      console.error('❌ Error getting token from auth headers:', error);
      return null;
    }
  }, [getAuthHeaders]);

  // Initialize WebSocket connection - IMPROVED VERSION
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        console.log('🔄 Starting WebSocket initialization...');
        setConnectionStatus('connecting');
        
        const token = await getToken();
        
        if (!token) {
          console.error('❌ No token available for WebSocket connection');
          setConnectionStatus('error');
          return;
        }

        console.log('✅ Token obtained, connecting to WebSocket...');
        
        // Disconnect existing socket if any
        if (socketRef.current) {
          socketRef.current.disconnect();
        }

        socketRef.current = io('http://localhost:3000', {
          auth: {
            token: token
          },
          transports: ['websocket', 'polling'],
          timeout: 10000,
          forceNew: true
        });

        socketRef.current.on('connect', () => {
          console.log('✅ ✅ ✅ SUCCESS: Connected to notifications WebSocket');
          console.log('Socket ID:', socketRef.current?.id);
          setConnectionStatus('connected');
          socketRef.current?.emit('subscribe_notifications');
          
          // Request initial unread count
          socketRef.current?.emit('get_unread_count');
        });

        socketRef.current.on('disconnect', (reason) => {
          console.log('🔌 WebSocket disconnected:', reason);
          setConnectionStatus('disconnected');
        });

        socketRef.current.on('connect_error', (error) => {
          console.error('❌ WebSocket connection error:', error.message);
          console.error('Error details:', error);
          setConnectionStatus('error');
        });

        // Add ping/pong for connection health
        socketRef.current.on('ping', () => {
          console.log('🏓 WebSocket ping received');
        });

        socketRef.current.on('pong', () => {
          console.log('🏓 WebSocket pong sent');
        });

        // Rest of your event handlers...
        socketRef.current.on('new_notification', (data) => {
          console.log('📨 New notification received:', data);
          setNotifications(prev => [data.notification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          Animated.sequence([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
          ]).start();
        });

        socketRef.current.on('unread_count_updated', (data) => {
          console.log('🔄 Unread count updated:', data.unreadCount);
          setUnreadCount(data.unreadCount);
        });

        socketRef.current.on('notification_marked_read', (data) => {
          console.log('✅ Notification marked as read:', data);
        });

        socketRef.current.on('all_notifications_marked_read', (data) => {
          console.log('✅ All notifications marked as read:', data);
        });

        socketRef.current.on('notification_deleted', (data) => {
          console.log('🗑️ Notification deleted:', data);
        });

        // Test the connection after a delay
        setTimeout(() => {
          if (socketRef.current?.connected) {
            console.log('🎉 WebSocket connection confirmed working!');
          } else {
            console.error('💥 WebSocket failed to connect');
          }
        }, 2000);

      } catch (error) {
        console.error('❌ Error initializing WebSocket:', error);
        setConnectionStatus('error');
      }
    };

    initializeWebSocket();

    return () => {
      console.log('🔌 Cleaning up WebSocket connection...');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [getToken]);

  // Test WebSocket connection
  const testWebSocket = () => {
    if (socketRef.current?.connected) {
      console.log('✅ WebSocket is connected');
      socketRef.current.emit('get_unread_count');
      Alert.alert('Success', 'WebSocket is connected!');
    } else {
      console.log('❌ WebSocket is not connected');
      Alert.alert('Error', 'WebSocket is not connected');
    }
  };

  // Fetch notifications
  const fetchNotifications = useCallback(async (showRefresh = false) => {
    try {
      if (!showRefresh) setLoading(true);
      
      console.log('🔄 Fetching notifications...');
      const response = await makeApiCall(`http://localhost:3000/notifications`, {
        method: 'GET',
        getAuthHeaders,
      });

      if (!response.ok) throw new Error('Failed to fetch notifications');

      const data = await response.json();
      if (data.success) {
        console.log(`✅ Loaded ${data.notifications.length} notifications`);
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeaders]);

  // Mark as read with WebSocket
  const markAsRead = async (notificationId: string) => {
    try {
      console.log('📝 Marking notification as read:', notificationId);
      socketRef.current?.emit('mark_notification_read', { notificationId });
      
      // Optimistic update
      setNotifications(prev => 
        prev.map(notif => 
          notif._id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      console.log('📝 Marking all notifications as read');
      socketRef.current?.emit('mark_all_notifications_read');
      
      // Optimistic update
      setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })));
      setUnreadCount(0);
      
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      console.error('❌ Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  // Handle friend request
  const handleFriendRequest = async (requestId: string, notificationId: string, action: 'accept' | 'reject') => {
    try {
      console.log(`🤝 ${action}ing friend request:`, requestId);
      const response = await makeApiCall(`http://localhost:3000/friends/${requestId}`, {
        method: 'PUT',
        body: { action },
        getAuthHeaders,
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
        setUnreadCount(prev => Math.max(0, prev - 1));
        Alert.alert('Success', `Friend request ${action}ed`);
      } else {
        throw new Error(`Failed to ${action} friend request`);
      }
    } catch (error) {
      console.error(`❌ Error ${action}ing friend request:`, error);
      Alert.alert('Error', `Failed to ${action} friend request`);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      console.log('🗑️ Deleting notification:', notificationId);
      socketRef.current?.emit('delete_notification', { notificationId });
      
      // Optimistic update
      setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
      const wasUnread = notifications.find(n => n._id === notificationId)?.isRead === false;
      if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
    }
  };

  const onRefresh = useCallback(() => {
    console.log('🔄 Refreshing notifications...');
    setRefreshing(true);
    fetchNotifications(true);
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d`;
    return date.toLocaleDateString();
  };

  // Get notification icon and color
  const getNotificationConfig = (type: string) => {
    const configs = {
      friend_request: {
        icon: "person-add",
        color: "#10B981",
        gradient: ['#10B981', '#059669'],
        emoji: "👋"
      },
      post_like: {
        icon: "heart",
        color: "#EF4444",
        gradient: ['#EF4444', '#DC2626'],
        emoji: "❤️"
      },
      post_comment: {
        icon: "chatbubble",
        color: "#3B82F6",
        gradient: ['#3B82F6', '#2563EB'],
        emoji: "💬"
      },
      friend_request_accepted: {
        icon: "checkmark-circle",
        color: "#10B981",
        gradient: ['#10B981', '#059669'],
        emoji: "✅"
      },
      post_share: {
        icon: "share-social",
        color: "#8B5CF6",
        gradient: ['#8B5CF6', '#7C3AED'],
        emoji: "🔄"
      },
      mention: {
        icon: "at",
        color: "#F59E0B",
        gradient: ['#F59E0B', '#D97706'],
        emoji: "📍"
      },
    };

    return configs[type as keyof typeof configs] || {
      icon: "notifications",
      color: colors.textSecondary,
      gradient: [colors.textSecondary, colors.textSecondary],
      emoji: "🔔"
    };
  };

  // Filter notifications based on active tab
  const filteredNotifications = notifications.filter(notification => 
    activeTab === 'all' ? true : !notification.isRead
  );

  // Show loading while fonts are loading
  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render notification item
  const renderNotification = (notification: Notification, index: number) => {
    const config = getNotificationConfig(notification.type);
    const senderName = notification.sender?.name || 'Someone';
    const profilePicture = notification.sender?.profilePicture;

    return (
      <Animated.View
        key={notification._id}
        style={[
          styles.notificationCard,
          !notification.isRead && styles.unreadCard,
        ]}
      >
        <View style={styles.notificationHeader}>
          <View style={styles.userInfo}>
            {profilePicture ? (
              <Image 
                source={{ uri: profilePicture }} 
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: config.color + '20' }]}>
                <Text style={[styles.avatarText, { color: config.color }]}>
                  {senderName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{senderName}</Text>
              <View style={styles.notificationType}>
                <View style={[styles.typeIndicator, { backgroundColor: config.color }]} />
                <Text style={styles.typeText}>
                  {notification.type.replace('_', ' ')}
                </Text>
                <Text style={styles.timeText}>{formatTime(notification.createdAt)}</Text>
              </View>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => {
              Alert.alert(
                'Notification Options',
                '',
                [
                  { 
                    text: 'Mark as Read', 
                    onPress: () => markAsRead(notification._id),
                    style: 'default'
                  },
                  { 
                    text: 'Delete', 
                    style: 'destructive',
                    onPress: () => deleteNotification(notification._id)
                  },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.notificationContent}>
          <View style={[styles.iconContainer, { backgroundColor: config.color + '15' }]}>
            <Text style={styles.emoji}>{config.emoji}</Text>
          </View>
          <Text style={styles.messageText}>{notification.message}</Text>
        </View>

        {notification.type === "friend_request" && notification.metadata?.requestId && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleFriendRequest(notification.metadata!.requestId!, notification._id, 'accept')}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={() => handleFriendRequest(notification.metadata!.requestId!, notification._id, 'reject')}
            >
              <Ionicons name="close" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}

        {!notification.isRead && (
          <View style={[styles.unreadIndicator, { backgroundColor: config.color }]} />
        )}
      </Animated.View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        {/* App Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SmartConnect</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* App Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SmartConnect</Text>
      </View>

      {/* Connection Status */}
      {/* Header */}
      <View style={styles.notificationsHeader}>
        <View>
          <Text style={styles.notificationsHeaderTitle}>Notifications</Text>
          <Text style={styles.notificationsHeaderSubtitle}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up! 🎉'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'unread' && styles.activeTab]}
          onPress={() => setActiveTab('unread')}
        >
          <View style={styles.tabWithBadge}>
            <Text style={[styles.tabText, activeTab === 'unread' && styles.activeTabText]}>
              Unread
            </Text>
            {unreadCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="notifications-off-outline" size={80} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyStateTitle}>
              {activeTab === 'all' ? 'No notifications yet' : 'No unread notifications'}
            </Text>
            <Text style={styles.emptyStateText}>
              {activeTab === 'all' 
                ? "When you get notifications, they'll appear here" 
                : "You're all caught up! No unread notifications"
              }
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {filteredNotifications.map(renderNotification)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // App Header Styles
  header: {
    paddingTop: 15,
    paddingBottom: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    
  },
  headerTitle: {
    fontSize: 32,
    color: colors.primary,
    fontFamily: "Carattere_400Regular",
    includeFontPadding: false,
  },
  // Notifications Header
  notificationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notificationsHeaderTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  notificationsHeaderSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginRight: 12,
  },
  testButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: colors.primary + '20',
    borderRadius: 12,
  },
  testButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  markAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary + '15',
    borderRadius: 20,
  },
  markAllText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: '#fff',
  },
  tabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBadge: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    minWidth: 20,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 16,
  },
  notificationsList: {
    padding: 16,
  },
  notificationCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  notificationType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  typeText: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  menuButton: {
    padding: 4,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 18,
  },
  messageText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginRight: 8,
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  declineButton: {
    backgroundColor: '#6B7280',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  unreadIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    opacity: 0.5,
    marginBottom: 24,
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});