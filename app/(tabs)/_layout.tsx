import { useThemeStyles } from "@/hooks/useThemeStyles";
import { Ionicons } from "@expo/vector-icons";
import { NavigationState } from "@react-navigation/native";
import { Tabs, useNavigation, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../context/AuthContext";

interface FriendRequest {
  _id: string;
  requesterId: string;
  recipientId: string;
  status: string;
  createdAt: string;
  requester?: {
    _id: string;
    name: string;
    profilePicture?: string;
  };
}

export default function TabLayout() {
  const { colors } = useThemeStyles();
  const { user, getAuthHeaders } = useAuth();
  const navigation = useNavigation();

  const [unreadCount, setUnreadCount] = useState(0);
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();

  // Get token from auth headers
  const getToken = async (): Promise<string | null> => {
    try {
      const authHeaders = await getAuthHeaders();
      const headers = authHeaders as Record<string, string>;

      const authKey = Object.keys(headers).find(
        (key) => key.toLowerCase() === "authorization"
      );

      const authHeader = authKey ? headers[authKey] : null;

      if (!authHeader) {
        return null;
      }

      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      return token || null;
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  };

  // Fetch friend requests count
  const fetchFriendRequestsCount = async () => {
    try {
      const authHeaders = await getAuthHeaders();
      const headers = {
        ...authHeaders,
        "Content-Type": "application/json",
      };

      const response = await fetch("http://localhost:3000/friends/requests", {
        method: "GET",
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFriendRequestsCount(data.requests?.length || 0);
        }
      }
    } catch (error) {
      console.error("Error fetching friend requests count:", error);
    }
  };

  // Initialize WebSocket for real-time notifications and friend requests
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        const token = await getToken();

        if (!token) {
          console.log("No token available for notifications");
          return;
        }

        // Disconnect existing socket if any
        if (socketRef.current) {
          socketRef.current.disconnect();
        }

        socketRef.current = io("http://localhost:3000", {
          auth: { token },
          transports: ["websocket", "polling"],
        });

        socketRef.current.on("connect", () => {
          console.log("✅ Connected to WebSocket in TabLayout");
          socketRef.current?.emit("subscribe_notifications");
          socketRef.current?.emit("get_unread_count");
        });

        // Notification events
        socketRef.current.on("unread_count_updated", (data) => {
          console.log(
            "🔄 Unread count updated in TabLayout:",
            data.unreadCount
          );
          setUnreadCount(data.unreadCount);
        });

        socketRef.current.on("unread_count", (data) => {
          console.log("📊 Initial unread count:", data.unreadCount);
          setUnreadCount(data.unreadCount);
        });

        socketRef.current.on("new_notification", (data) => {
          // When new notification arrives, increment count
          setUnreadCount((prev) => prev + 1);

          // If it's a friend request notification, also update friend requests count
          if (data.notification?.type === "friend_request") {
            setFriendRequestsCount((prev) => prev + 1);
          }
        });

        // Friend request events (we'll simulate these since backend might not have specific events)
        socketRef.current.on("friend_request_received", () => {
          setFriendRequestsCount((prev) => prev + 1);
        });

        socketRef.current.on("friend_request_accepted", () => {
          // Optionally handle when someone accepts your friend request
        });

        socketRef.current.on("friend_request_declined", () => {
          // Optionally handle when someone declines your friend request
        });

        socketRef.current.on("connect_error", (error) => {
          console.error("❌ WebSocket connection error in TabLayout:", error);
        });
      } catch (error) {
        console.error("Error initializing WebSocket in TabLayout:", error);
      }
    };

    initializeWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Fetch initial counts on component mount
  useEffect(() => {
    const fetchInitialCounts = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const headers = {
          ...authHeaders,
          "Content-Type": "application/json",
        };

        // Fetch unread notifications count
        const notificationsResponse = await fetch(
          "http://localhost:3000/notifications/unread-count",
          {
            method: "GET",
            headers,
          }
        );

        if (notificationsResponse.ok) {
          const notificationsData = await notificationsResponse.json();
          if (notificationsData.success) {
            setUnreadCount(notificationsData.unreadCount);
          }
        }

        // Fetch friend requests count
        await fetchFriendRequestsCount();
      } catch (error) {
        console.error("Error fetching initial counts:", error);
      }
    };

    fetchInitialCounts();
  }, []);

  // Listen for navigation events to refresh friend requests count
  useEffect(() => {
    const unsubscribe = navigation.addListener("state", (e) => {
      const state = e.data.state as NavigationState;
      const currentRoute = state.routes[state.index];

      // Check the current route name
      if (
        currentRoute.name === "friends" ||
        currentRoute.name === "notifications"
      ) {
        fetchFriendRequestsCount();
      }
    });

    return unsubscribe;
  }, [navigation]);

  // Custom Notification Icon with Badge
  const NotificationIconWithBadge = ({
    color,
    focused,
  }: {
    color: string;
    focused: boolean;
  }) => (
    <View style={styles.iconContainer}>
      <Ionicons
        name={focused ? "notifications" : "notifications-outline"}
        color={color}
        size={24}
      />
      {unreadCount > 0 && (
        <View
          style={[
            styles.badge,
            unreadCount > 9 && styles.badgeLarge,
            unreadCount > 99 && styles.badgeExtraLarge,
          ]}
        >
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </View>
  );

  // Custom Friends Icon with Badge
  const FriendsIconWithBadge = ({
    color,
    focused,
  }: {
    color: string;
    focused: boolean;
  }) => (
    <View style={styles.iconContainer}>
      <Ionicons
        name={focused ? "people" : "people-outline"}
        color={color}
        size={24}
      />
      {friendRequestsCount > 0 && (
        <View
          style={[
            styles.badge,
            styles.friendsBadge,
            friendRequestsCount > 9 && styles.badgeLarge,
            friendRequestsCount > 99 && styles.badgeExtraLarge,
          ]}
        >
          <Text style={styles.badgeText}>
            {friendRequestsCount > 99 ? "99+" : friendRequestsCount}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
          headerShown: false,
          tabBarShowLabel: true, // Show labels for clarity
          tabBarStyle: {
            height: 60,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
            marginBottom: 4,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.iconContainer}>
                <Ionicons
                  name={focused ? "home" : "home-outline"}
                  color={color}
                  size={24}
                />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="friends"
          options={{
            title: "Friends",
            tabBarIcon: ({ color, focused }) => (
              <FriendsIconWithBadge color={color} focused={focused} />
            ),
          }}
        />

        <Tabs.Screen
          name="create-post"
          options={{
            title: "Create",
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.iconContainer}>
                <Ionicons
                  name={focused ? "add-circle" : "add-circle-outline"}
                  color={color}
                  size={26}
                />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="notifications"
          options={{
            title: "Notify",
            tabBarIcon: ({ color, focused }) => (
              <NotificationIconWithBadge color={color} focused={focused} />
            ),
          }}
        />

        <Tabs.Screen
          name="menu"
          options={{
            title: "More",
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.iconContainer}>
                <Ionicons
                  name={focused ? "menu" : "menu-outline"}
                  color={color}
                  size={24}
                />
              </View>
            ),
          }}
        />

        {/* Hidden screens */}
        <Tabs.Screen
          name="map"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="chat/[id]"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="UserProfileScreen"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    padding: 8,
    position: "relative",
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  friendsBadge: {
    backgroundColor: "#007AFF", // Blue color for friend requests
  },
  badgeLarge: {
    minWidth: 22,
    height: 18,
  },
  badgeExtraLarge: {
    minWidth: 26,
    height: 18,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
    paddingHorizontal: 4,
  },
});