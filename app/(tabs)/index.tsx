import { useThemeStyles } from "@/hooks/useThemeStyles";
import { Carattere_400Regular, useFonts } from "@expo-google-fonts/carattere";
import { Ionicons } from "@expo/vector-icons";
import { Audio, ResizeMode, Video } from "expo-av";
import * as Clipboard from "expo-clipboard";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../context/AuthContext";

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face";

type User = {
  _id: string;
  name: string;
  email: string;
  profilePicture: string;
  bio: string;
  isProfileComplete: boolean;
  postsCount?: number;
  friendsCount?: number;
};

type ApiPost = {
  _id: string;
  userId: string;
  user?: User;
  content: string;
  image?: string;
  imageData?: any;
  privacy: string;
  likes: Array<{
    userId: string;
    likedAt: Date;
  }>;
  comments: Array<{
    _id: string;
    userId: string;
    user?: User;
    content: string;
    createdAt: Date;
  }>;
  shares: number;
  createdAt: Date;
  updatedAt: Date;
  location?: string;
  type?: "post" | "reel";
  distance?: number;
};

type ApiStory = {
  _id: string;
  userId: string;
  user?: User;
  image: string;
  content: string;
  createdAt: Date;
  expiresAt: Date;
  seen?: boolean;
};

// Component Types
type Post = {
  id: string;
  username: string;
  name: string;
  content: string;
  likes: number;
  comments: number;
  time: string;
  userImage: string;
  image?: string;
  videoUrl?: string;
  shares: number;
  isLiked: boolean;
  commentsList: Array<{
    id: string;
    username: string;
    name: string;
    comment: string;
    time: string;
  }>;
  location?: string;
  type: "post" | "reel";
  distance?: number;
  duration?: number;
  // For API operations
  _id?: string;
  userId?: string;
};

type StoryType = {
  id: string;
  username: string;
  name: string;
  avatar: string;
  hasNewStory: boolean;
  isUser: boolean;
  stories: Array<{
    id: string;
    type: "image" | "video";
    url: string;
    duration: number;
    seen: boolean;
    timestamp: string;
  }>;
  // For API operations
  _id?: string;
  userId?: string;
};

type CreateStoryType = {
  image: string;
  content: string;
};

// API Configuration
const API_BASE_URL = "http://localhost:3000";

// Tab types
type HomeTab = "posts" | "reels" | "nearby";

// Styles function
const createStyles = (colors: any, fontsLoaded: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // Enhanced Header Styles
    appHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
      shadowColor: colors.text,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 4,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    appTitle: {
      fontSize: 32,
      fontFamily: fontsLoaded ? "Carattere_400Regular" : "System",
      color: colors.accent,
      marginLeft: 8,
      includeFontPadding: false,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    messageIcon: {
      padding: 8,
      position: "relative",
      backgroundColor: colors.background,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    // Search Bar Styles
    searchContainer: {
      padding: 16,
      paddingBottom: 8,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 25,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      padding: 0,
    },
    searchPlaceholder: {
      color: colors.textSecondary,
    },
    // Tab Navigation Styles
    tabContainer: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 16,
    },
    tabScrollContent: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    tab: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    activeTab: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabText: {
      marginLeft: 6,
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    activeTabText: {
      color: "#FFFFFF",
    },
    // Notification Badge Styles
    notificationBadge: {
      position: "absolute",
      top: 4,
      right: 4,
      backgroundColor: "#FF3B30",
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.surface,
    },
    notificationText: {
      color: "white",
      fontSize: 10,
      fontWeight: "bold",
      textAlign: "center",
    },
    // Popup Notification Styles
    popupNotification: {
      position: "absolute",
      top: 60,
      left: 16,
      right: 16,
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 12,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      zIndex: 1000,
    },
    notificationContent: {
      flexDirection: "row",
      alignItems: "center",
    },
    notificationAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
    },
    notificationTextContainer: {
      flex: 1,
      marginRight: 12,
    },
    notificationName: {
      color: "white",
      fontSize: 14,
      fontWeight: "bold",
      marginBottom: 2,
    },
    notificationMessage: {
      color: "white",
      fontSize: 12,
      opacity: 0.9,
    },
    listContent: {
      paddingBottom: 20,
    },
    reelsContent: {
      paddingBottom: 20,
    },
    // Stories Section
    storiesSection: {
      paddingVertical: 15,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    storiesList: {
      paddingHorizontal: 4,
    },
    storyContainer: {
      alignItems: "center",
      marginHorizontal: 6,
      width: 72,
    },
    storyCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 2.5,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
      position: "relative",
      backgroundColor: colors.surface,
    },
    hasNewStory: {
      borderColor: colors.primary,
    },
    seenStory: {
      borderColor: colors.border,
    },
    storyImage: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    storyUsername: {
      fontSize: 12,
      color: colors.text,
      fontWeight: "500",
      textAlign: "center",
      marginTop: 2,
    },
    addStoryButton: {
      position: "absolute",
      bottom: -2,
      right: -2,
      backgroundColor: colors.primary,
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.surface,
    },
    addStoryText: {
      color: "white",
      fontSize: 12,
      fontWeight: "bold",
    },

    // Post Styles
    post: {
      backgroundColor: colors.surface,
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 16,
      borderRadius: 12,
      marginHorizontal: 12,
    },
    postHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      paddingHorizontal: 16,
    },
    userAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    userInfo: {
      flex: 1,
    },
    name: {
      fontWeight: "600",
      fontSize: 16,
      color: colors.text,
      marginBottom: 2,
    },
    username: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },
    locationText: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
      flexDirection: "row",
      alignItems: "center",
    },
    moreButton: {
      padding: 4,
    },
    moreText: {
      color: colors.textSecondary,
      fontSize: 18,
      fontWeight: "bold",
    },
    content: {
      fontSize: 15,
      lineHeight: 20,
      color: colors.text,
      paddingHorizontal: 16,
      marginBottom: 12,
      fontWeight: "400",
    },
    postImage: {
      width: "100%",
      height: 400,
      marginBottom: 12,
      borderRadius: 8,
    },
    // Enhanced Post Actions with Labels
    postActions: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 8,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: colors.background,
      minWidth: 80,
      justifyContent: "center",
    },
    actionButtonLiked: {
      backgroundColor: "rgba(255, 59, 48, 0.1)",
    },
    actionContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    actionText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    actionTextLiked: {
      color: "#FF3B30",
    },
    actionCount: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: 4,
      fontWeight: "500",
    },
    actionCountLiked: {
      color: "#FF3B30",
    },

    // Reel Styles
    reel: {
      height: "100%",
      backgroundColor: "#000",
    },
    reelHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    reelUserAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginRight: 8,
    },
    reelUsername: {
      color: "white",
      fontSize: 14,
      fontWeight: "600",
      flex: 1,
    },
    followButton: {
      backgroundColor: "#0095F6",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    followButtonText: {
      color: "white",
      fontSize: 12,
      fontWeight: "600",
    },
    reelContent: {
      flex: 1,
      justifyContent: "center",
    },
    reelImage: {
      width: "100%",
      height: "100%",
    },
    reelVideo: {
      width: "100%",
      height: "100%",
    },
    reelOverlay: {
      position: "absolute",
      bottom: 80,
      left: 16,
      right: 16,
    },
    reelText: {
      color: "white",
      fontSize: 16,
      fontWeight: "500",
    },
    reelLocation: {
      color: "white",
      fontSize: 12,
      marginTop: 4,
      opacity: 0.8,
    },
    reelActions: {
      position: "absolute",
      right: 16,
      bottom: 80,
      alignItems: "center",
      gap: 20,
    },
    reelAction: {
      alignItems: "center",
    },
    reelActionText: {
      color: "white",
      fontSize: 12,
      marginTop: 4,
      fontWeight: "500",
    },

    // Empty State Styles
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyStateText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    enableLocationButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 25,
      marginTop: 16,
    },
    enableLocationText: {
      color: "white",
      fontSize: 14,
      fontWeight: "600",
    },
    nearbyDistance: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
      paddingHorizontal: 16,
    },

    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      justifyContent: "flex-end",
    },
    commentsModal: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "80%",
    },
    optionsModal: {
      backgroundColor: colors.surface,
      margin: 20,
      borderRadius: 15,
      padding: 10,
      maxWidth: 400,
      alignSelf: "center",
      width: "90%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
    },
    commentsList: {
      maxHeight: 400,
      padding: 16,
    },
    commentItem: {
      backgroundColor: colors.background,
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
    },
    commentHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    commentName: {
      color: colors.text,
      fontWeight: "600",
      fontSize: 14,
    },
    commentTime: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    commentText: {
      color: colors.text,
      fontSize: 14,
    },
    commentInputContainer: {
      flexDirection: "row",
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: "flex-end",
    },
    commentInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 12,
      color: colors.text,
      marginRight: 10,
      maxHeight: 100,
    },
    commentSubmitButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 20,
    },
    commentSubmitDisabled: {
      backgroundColor: colors.textSecondary,
    },
    commentSubmitText: {
      color: "#ffffff",
      fontWeight: "600",
    },
    optionButton: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "500",
    },
    reportOption: {
      color: colors.error,
    },
    cancelButton: {
      borderBottomWidth: 0,
      marginTop: 10,
    },
    cancelText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
    closeButtonText: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "300",
    },
  });

export default function HomeScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Post[]>([]);
  const [fontsLoaded] = useFonts({
    Carattere_400Regular,
  });
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedPostForOptions, setSelectedPostForOptions] =
    useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<HomeTab>("posts");
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Story states
  const [stories, setStories] = useState<StoryType[]>([]);
  const { getAuthHeaders, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Message notification state
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [newMessageNotification, setNewMessageNotification] = useState<{
    show: boolean;
    conversationId: string;
    message: any;
  } | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const { colors } = useThemeStyles();
  const styles = createStyles(colors, fontsLoaded || false);

  // Helper function to format time
  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor(
      (now.getTime() - new Date(date).getTime()) / 1000
    );

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  // Get token from auth headers
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const authHeaders = await getAuthHeaders();
      const headers = authHeaders as Record<string, string>;

      const authKey = Object.keys(headers).find(
        (key) => key.toLowerCase() === "authorization"
      );

      // FIX: Use authKey instead of Key
      const authHeader = authKey ? headers[authKey] : null;

      if (!authHeader) {
        console.log("No Authorization header found");
        return null;
      }

      const token = authHeader.replace(/^Bearer\s+/i, "").trim();

      if (!token) {
        console.log("Empty token found in Authorization header");
        return null;
      }

      console.log("✅ Token extracted successfully");
      return token;
    } catch (error) {
      console.error("❌ Error getting token from auth headers:", error);
      return null;
    }
  }, [getAuthHeaders]);

  // Get user location
  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("Location permission denied");
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        console.error("Error getting location:", error);
      }
    };

    getLocation();
  }, []);

  // Calculate total unread messages from conversations
  const fetchUnreadMessageCount = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/conversations`, {
        credentials: "include",
        headers: headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const totalUnread = data.conversations.reduce(
            (total: number, conv: any) => {
              return total + (conv.unreadCount || 0);
            },
            0
          );

          setUnreadMessageCount(totalUnread);
        }
      }
    } catch (error) {
      console.error("Error fetching unread messages:", error);
    }
  };

  // Initialize WebSocket for real-time notifications
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const initializeWebSocket = async () => {
      const token = await getToken();
      if (!token) return;

      console.log("Initializing WebSocket connection for HomeScreen...");

      const newSocket = io("http://localhost:3000", {
        auth: {
          token: token,
        },
        transports: ["websocket", "polling"],
      });

      newSocket.on("connect", () => {
        console.log("HomeScreen WebSocket connected successfully");
      });

      newSocket.on("disconnect", () => {
        console.log("HomeScreen WebSocket disconnected");
      });

      newSocket.on("connect_error", (error) => {
        console.error("HomeScreen WebSocket connection error:", error);
      });

      newSocket.on("new_message", (data) => {
        console.log("New message received in HomeScreen:", data);

        setUnreadMessageCount((prev) => prev + 1);

        setNewMessageNotification({
          show: true,
          conversationId: data.conversationId,
          message: data.message,
        });

        setTimeout(() => {
          setNewMessageNotification(null);
        }, 3000);
      });

      newSocket.on("messages_read", (data) => {
        console.log("Messages read event in HomeScreen:", data);
        fetchUnreadMessageCount();
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    };

    initializeWebSocket();
  }, [isAuthenticated, user, getToken]);

  // Handle notification press
  const handleNotificationPress = () => {
    if (newMessageNotification) {
      setNewMessageNotification(null);
      setUnreadMessageCount(0);
      router.push("/(tabs)/messages");
    }
  };

  // Fetch current user data
  const fetchCurrentUser = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/profile`, {
        credentials: "include",
        headers: headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCurrentUser(data.user);
          return data.user;
        }
      }
      return null;
    } catch (error) {
      console.error("Error fetching current user:", error);
      return null;
    }
  };

  // Fetch posts from API
  const fetchPosts = useCallback(async () => {
    try {
      if (!isAuthenticated) {
        console.log("User not authenticated, redirecting to login...");
        return;
      }

      setLoading(true);

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/posts`, {
        credentials: "include",
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const transformedPosts: Post[] = data.posts.map((post: ApiPost) => ({
          id: post._id,
          _id: post._id,
          userId: post.userId,
          username:
            post.user?.name?.toLowerCase().replace(/\s+/g, "") || "user",
          name: post.user?.name || "User",
          content: post.content,
          likes: post.likes.length,
          comments: post.comments.length,
          time: getTimeAgo(post.createdAt),
          userImage: post.user?.profilePicture || DEFAULT_AVATAR,
          image: post.image,
          isLiked: post.likes.some((like) => like.userId === user?.id),
          location: post.location,
          type: post.type || "post",
          distance: post.distance,
          commentsList: post.comments.map((comment) => ({
            id: comment._id,
            username:
              comment.user?.name?.toLowerCase().replace(/\s+/g, "") || "user",
            name: comment.user?.name || "User",
            comment: comment.content,
            time: getTimeAgo(comment.createdAt),
          })),
        }));

        setPosts(transformedPosts);
      } else {
        throw new Error(data.message || "Failed to load posts");
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      Alert.alert("Error", "Failed to load posts from server.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  // Fetch reels from API
  const fetchReels = useCallback(async () => {
    try {
      if (!isAuthenticated) return;

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/reels/feed`, {
        credentials: "include",
        headers: headers,
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      if (data.success) {
        const transformedReels: Post[] = data.reels.map((reel: any) => ({
          id: reel._id,
          _id: reel._id,
          userId: reel.userId,
          username:
            reel.user?.name?.toLowerCase().replace(/\s+/g, "") || "user",
          name: reel.user?.name || "User",
          content: reel.caption,
          likes: reel.likes?.length || 0,
          comments: reel.comments?.length || 0,
          time: getTimeAgo(reel.createdAt),
          userImage: reel.user?.profilePicture || DEFAULT_AVATAR,
          image: reel.thumbnailUrl
            ? `${API_BASE_URL}${reel.thumbnailUrl}`
            : null,
          videoUrl: reel.videoUrl ? `${API_BASE_URL}${reel.videoUrl}` : null,
          shares: reel.shares || 0,
          isLiked:
            reel.likes?.some((like: any) => like.userId === user?.id) || false,
          location: reel.location,
          type: "reel",
          duration: reel.duration,
          commentsList:
            reel.comments?.map((comment: any) => ({
              id: comment._id,
              username:
                comment.user?.name?.toLowerCase().replace(/\s+/g, "") || "user",
              name: comment.user?.name || "User",
              comment: comment.content,
              time: getTimeAgo(comment.createdAt),
            })) || [],
        }));

        setReels(transformedReels);
      }
    } catch (error) {
      console.error("Error fetching reels:", error);
    }
  }, [isAuthenticated, user?.id]);

  // Fetch nearby posts based on location
  const fetchNearbyPosts = useCallback(async () => {
    try {
      if (!isAuthenticated || !userLocation) return;

      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/posts/nearby?lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius=10`,
        {
          credentials: "include",
          headers: headers,
        }
      );

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      if (data.success) {
        const transformedPosts: Post[] = data.posts.map((post: ApiPost) => ({
          id: post._id,
          _id: post._id,
          userId: post.userId,
          username:
            post.user?.name?.toLowerCase().replace(/\s+/g, "") || "user",
          name: post.user?.name || "User",
          content: post.content,
          likes: post.likes.length,
          comments: post.comments.length,
          time: getTimeAgo(post.createdAt),
          userImage: post.user?.profilePicture || DEFAULT_AVATAR,
          image: post.image,
          isLiked: post.likes.some((like) => like.userId === user?.id),
          location: post.location,
          type: post.type || "post",
          distance: post.distance,
          commentsList: post.comments.map((comment) => ({
            id: comment._id,
            username:
              comment.user?.name?.toLowerCase().replace(/\s+/g, "") || "user",
            name: comment.user?.name || "User",
            comment: comment.content,
            time: getTimeAgo(comment.createdAt),
          })),
        }));

        // Update posts for nearby tab
        setPosts((prev) => [
          ...prev.filter((p) => p.type !== "post"),
          ...transformedPosts,
        ]);
      }
    } catch (error) {
      console.error("Error fetching nearby posts:", error);
    }
  }, [isAuthenticated, userLocation, user?.id]);

  // Fetch stories from API
  const fetchStories = async () => {
    try {
      if (!isAuthenticated) {
        console.log("User not authenticated, redirecting to login...");
        return;
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/stories`, {
        credentials: "include",
        headers: headers,
      });

      let transformedStories: StoryType[] = [];

      const user = await fetchCurrentUser();
      if (user) {
        const userStory: StoryType = {
          id: "current-user-story",
          username: user.name?.toLowerCase().replace(/\s+/g, "") || "user",
          name: user.name || "User",
          avatar: user.profilePicture || DEFAULT_AVATAR,
          hasNewStory: false,
          isUser: true,
          stories: [],
        };
        transformedStories.push(userStory);
      }

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.stories.length > 0) {
          const apiStories: StoryType[] = data.stories.map(
            (story: ApiStory) => ({
              id: story._id,
              _id: story._id,
              userId: story.userId,
              username:
                story.user?.name?.toLowerCase().replace(/\s+/g, "") || "user",
              name: story.user?.name || "User",
              avatar: story.user?.profilePicture || DEFAULT_AVATAR,
              hasNewStory: !story.seen,
              isUser: false,
              stories: [
                {
                  id: story._id,
                  type: "image" as const,
                  url: story.image,
                  duration: 5,
                  seen: story.seen || false,
                  timestamp: getTimeAgo(story.createdAt),
                },
              ],
            })
          );

          transformedStories = [...transformedStories, ...apiStories];
        }
      }

      setStories(transformedStories);
    } catch (error) {
      console.error("Error fetching stories:", error);

      const user = await fetchCurrentUser();
      if (user) {
        const userStory: StoryType = {
          id: "current-user-story",
          username: user.name?.toLowerCase().replace(/\s+/g, "") || "user",
          name: user.name || "User",
          avatar: user.profilePicture || DEFAULT_AVATAR,
          hasNewStory: false,
          isUser: true,
          stories: [],
        };
        setStories([userStory]);
      }
    }
  };

  // Ensure current user is always shown in stories
  useEffect(() => {
    const ensureCurrentUserStory = async () => {
      if (stories.length === 0 || !stories.some((story) => story.isUser)) {
        const user = await fetchCurrentUser();
        if (user) {
          const userStory: StoryType = {
            id: "current-user-story",
            username: user.name?.toLowerCase().replace(/\s+/g, "") || "user",
            name: user.name || "User",
            avatar: user.profilePicture || DEFAULT_AVATAR,
            hasNewStory: false,
            isUser: true,
            stories: [],
          };
          setStories((prev) => [
            userStory,
            ...prev.filter((story) => !story.isUser),
          ]);
        }
      }
    };

    ensureCurrentUserStory();
  }, [stories]);

  // Set up message polling and initial fetch
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchUnreadMessageCount();

    const messageInterval = setInterval(() => {
      fetchUnreadMessageCount();
    }, 30000);

    return () => clearInterval(messageInterval);
  }, [isAuthenticated]);

  // Fetch data on component mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchPosts();
      fetchReels();
      fetchStories();

      if (userLocation) {
        fetchNearbyPosts();
      }

      const interval = setInterval(() => {
        fetchPosts();
        fetchReels();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchPosts, fetchReels, userLocation]);

  // Listen for refresh events
  useFocusEffect(
    useCallback(() => {
      console.log("Home screen focused - refreshing data...");
      fetchPosts();
      fetchReels();
      fetchStories();
      if (isAuthenticated) {
        fetchUnreadMessageCount();
      }
    }, [fetchPosts, fetchReels, isAuthenticated])
  );

  // Handle search
  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push({
        pathname: "/(tabs)/search",
        params: { query: searchQuery },
      });
    }
  };

  // Filter posts based on active tab
  const filteredPosts = posts.filter((post) => {
    switch (activeTab) {
      case "posts":
        return post.type === "post";
      case "reels":
        return post.type === "reel";
      case "nearby":
        return (
          post.location && post.distance !== undefined && post.distance <= 10
        );
      default:
        return true;
    }
  });

  // Fixed Like/Unlike Post
  const likePost = async (postId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/like`, {
        method: "POST",
        headers: headers as HeadersInit,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPosts((prevPosts) =>
          prevPosts.map((post) => {
            if (post._id === postId) {
              const hasLiked = post.isLiked;
              return {
                ...post,
                likes: hasLiked ? post.likes - 1 : post.likes + 1,
                isLiked: !hasLiked,
              };
            }
            return post;
          })
        );
      } else {
        throw new Error(data.message || "Failed to like post");
      }
    } catch (error) {
      console.error("Error liking post:", error);
      Alert.alert("Error", "Failed to like post");
    }
  };

  // Fixed Comment on Post
  const addComment = async (postId: string) => {
    if (!newComment.trim()) {
      Alert.alert("Error", "Please enter a comment");
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/comment`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        } as HeadersInit,
        body: JSON.stringify({ content: newComment }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPosts((prevPosts) =>
          prevPosts.map((post) => {
            if (post._id === postId) {
              return {
                ...post,
                comments: post.comments + 1,
                commentsList: [
                  ...post.commentsList,
                  {
                    id: data.comment._id,
                    username:
                      data.comment.user?.name
                        ?.toLowerCase()
                        .replace(/\s+/g, "") || "user",
                    name: data.comment.user?.name || "You",
                    comment: data.comment.content,
                    time: "Just now",
                  },
                ],
              };
            }
            return post;
          })
        );
        setNewComment("");
        setCommentModalVisible(false);
        Alert.alert("Success", "Comment added successfully");
      } else {
        throw new Error(data.message || "Failed to add comment");
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      Alert.alert("Error", "Failed to add comment");
    }
  };

  // Fixed Share Post
  const sharePost = async (post: Post) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/posts/${post._id}/share`, {
        method: "POST",
        headers: headers as HeadersInit,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPosts((prevPosts) =>
          prevPosts.map((p) => {
            if (p._id === post._id) {
              return {
                ...p,
                shares: p.shares + 1,
              };
            }
            return p;
          })
        );
        Alert.alert("Success", "Post shared successfully");
      } else {
        throw new Error(data.message || "Failed to share post");
      }
    } catch (error) {
      console.error("Error sharing post:", error);

      const postLink = `https://socialapp.com/post/${post.id}`;
      if (Platform.OS === "web") {
        navigator.clipboard.writeText(postLink);
        Alert.alert("Link Copied!", "Post link has been copied to clipboard.");
      } else {
        try {
          await Sharing.shareAsync(postLink);
        } catch (shareError) {
          Clipboard.setStringAsync(postLink);
          Alert.alert(
            "Link Copied!",
            "Post link has been copied to clipboard."
          );
        }
      }
    }
  };

  const downloadImage = async (post: Post | null) => {
    if (!post?.image) {
      Alert.alert(
        "No Image",
        "This post does not contain an image to download."
      );
      return;
    }

    try {
      if (Platform.OS === "web") {
        window.open(post.image, "_blank");
        Alert.alert(
          "Image Opened",
          "Image opened in new tab. Right-click to save."
        );
      } else {
        await Sharing.shareAsync(post.image);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to open image. Please try again.");
    }

    setOptionsModalVisible(false);
  };

  const openComments = (post: Post) => {
    setSelectedPost(post);
    setCommentModalVisible(true);
  };

  const openOptions = (post: Post) => {
    setSelectedPostForOptions(post);
    setOptionsModalVisible(true);
  };

  // Navigate to messages screen and clear notifications
  const navigateToMessages = () => {
    setUnreadMessageCount(0);
    setNewMessageNotification(null);
    router.push("/(tabs)/messages");
  };

  // Enhanced Post Action Component
  const PostActionButton = ({
    icon,
    label,
    count,
    isActive = false,
    onPress,
    activeColor = "#FF3B30",
  }: {
    icon: string;
    label: string;
    count?: number;
    isActive?: boolean;
    onPress: () => void;
    activeColor?: string;
  }) => (
    <TouchableOpacity
      style={[styles.actionButton, isActive && styles.actionButtonLiked]}
      onPress={onPress}
    >
      <View style={styles.actionContent}>
        <Ionicons
          name={icon as any}
          size={20}
          color={isActive ? activeColor : colors.textSecondary}
        />
        <Text style={[styles.actionText, isActive && styles.actionTextLiked]}>
          {label}
        </Text>
        {count !== undefined && count > 0 && (
          <Text
            style={[styles.actionCount, isActive && styles.actionCountLiked]}
          >
            {count}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  // Reel Item Component with full functionality
  const ReelItem = ({ item }: { item: Post }) => {
    const [isLiked, setIsLiked] = useState(item.isLiked);
    const [likeCount, setLikeCount] = useState(item.likes);
    const [videoError, setVideoError] = useState(false);
    const videoRef = useRef<Video>(null);

      useEffect(() => {
    const configureAudio = async () => {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });
    };
    configureAudio();
  }, []);

  const handleVideoLoad = async () => {
    try {
      await handleViewReel();
      if (videoRef.current) {
        await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error loading video:', error);
      setVideoError(true);
    }
  };

  const handleVideoError = (error: any) => {
    console.error('Video error:', error);
    setVideoError(true);
  };
    const handleLikeReel = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/reels/${item._id}/like`, {
          method: "POST",
          headers: headers as HeadersInit,
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setIsLiked(!isLiked);
          setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
        }
      } catch (error) {
        console.error("Error liking reel:", error);
      }
    };

    const handleCommentReel = () => {
      setSelectedPost(item);
      setCommentModalVisible(true);
    };

    const handleShareReel = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(
          `${API_BASE_URL}/reels/${item._id}/share`,
          {
            method: "POST",
            headers: headers as HeadersInit,
          }
        );

        const data = await response.json();

        if (response.ok && data.success) {
          Alert.alert("Success", "Reel shared successfully");
        } else {
          // Fallback to regular sharing
          const reelLink = `https://socialapp.com/reel/${item.id}`;
          if (Platform.OS === "web") {
            navigator.clipboard.writeText(reelLink);
            Alert.alert(
              "Link Copied!",
              "Reel link has been copied to clipboard."
            );
          } else {
            try {
              await Sharing.shareAsync(reelLink);
            } catch (shareError) {
              Clipboard.setStringAsync(reelLink);
              Alert.alert(
                "Link Copied!",
                "Reel link has been copied to clipboard."
              );
            }
          }
        }
      } catch (error) {
        console.error("Error sharing reel:", error);
      }
    };

    const handleViewReel = async () => {
      try {
        const headers = await getAuthHeaders();
        await fetch(`${API_BASE_URL}/reels/${item._id}/view`, {
          method: "POST",
          headers: headers as HeadersInit,
        });
      } catch (error) {
        console.error("Error recording view:", error);
      }
    };

    return (
      <View style={styles.reel}>
        <View style={styles.reelHeader}>
          <Image
            source={{ uri: item.userImage }}
            style={styles.reelUserAvatar}
          />
          <Text style={styles.reelUsername}>@{item.username}</Text>
          <TouchableOpacity style={styles.followButton}>
            <Text style={styles.followButtonText}>Follow</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.reelContent}>
          {item.videoUrl && !videoError ? (
            <Video
              ref={videoRef}
              source={{ uri: item.videoUrl }}
              style={styles.reelVideo}
              resizeMode={ResizeMode.COVER}

              shouldPlay
              isLooping
              isMuted={false}
              useNativeControls={false}
              onLoad={handleVideoLoad}
              onError={handleVideoError}
              onPlaybackStatusUpdate={(status) => {
                if (!status.isLoaded) {
                  if (status.error) {
                    console.error("Video playback error:", status.error);
                    setVideoError(true);
                  }
                }
              }}
            />
          ) : (
            <Image source={{ uri: item.image }} style={styles.reelImage} />
          )}
          <View style={styles.reelOverlay}>
            <Text style={styles.reelText} numberOfLines={2}>
              {item.content}
            </Text>
            {item.distance && (
              <Text style={styles.reelLocation}>
                📍 {item.distance.toFixed(1)}km away
              </Text>
            )}
          </View>
        </View>

        <View style={styles.reelActions}>
          <TouchableOpacity style={styles.reelAction} onPress={handleLikeReel}>
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={24}
              color={isLiked ? "#FF3B30" : "white"}
            />
            <Text style={styles.reelActionText}>{likeCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reelAction}
            onPress={handleCommentReel}
          >
            <Ionicons name="chatbubble-outline" size={24} color="white" />
            <Text style={styles.reelActionText}>{item.comments}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.reelAction} onPress={handleShareReel}>
            <Ionicons name="share-outline" size={24} color="white" />
            <Text style={styles.reelActionText}>{item.shares}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.reelAction}>
            <Ionicons name="musical-notes" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Post Item Component
  const PostItem = ({ item }: { item: Post }) => (
    <View style={styles.post}>
      <View style={styles.postHeader}>
        <Image source={{ uri: item.userImage }} style={styles.userAvatar} />
        <View style={styles.userInfo}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.username}>
            @{item.username} · {item.time}
          </Text>
          {item.location && (
            <Text style={styles.locationText}>
              <Ionicons
                name="location-outline"
                size={12}
                color={colors.textSecondary}
              />
              {item.location}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => openOptions(item)}
        >
          <Text style={styles.moreText}>⋯</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.content}>{item.content}</Text>

      {item.image && (
        <Image source={{ uri: item.image }} style={styles.postImage} />
      )}

      <View style={styles.postActions}>
        <PostActionButton
          icon={item.isLiked ? "heart" : "heart-outline"}
          label="Like"
          count={item.likes}
          isActive={item.isLiked}
          onPress={() => likePost(item._id || item.id)}
          activeColor="#FF3B30"
        />

        <PostActionButton
          icon="chatbubble-outline"
          label="Comment"
          count={item.comments}
          onPress={() => openComments(item)}
          activeColor="#007AFF"
        />

        <PostActionButton
          icon="share-social-outline"
          label="Share"
          count={item.shares}
          onPress={() => sharePost(item)}
          activeColor="#34C759"
        />
      </View>
    </View>
  );

  // Search Bar Component
  const SearchBar = () => (
    <View style={styles.searchContainer}>
      <TouchableOpacity style={styles.searchBar} onPress={handleSearch}>
        <Ionicons
          name="search-outline"
          size={20}
          color={colors.textSecondary}
          style={styles.searchIcon}
        />
        <Text style={[styles.searchInput, styles.searchPlaceholder]}>
          Search posts, people, and more...
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Tab Navigation Component
  const TabNavigation = () => (
    <View style={styles.tabContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabScrollContent}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === "posts" && styles.activeTab]}
          onPress={() => setActiveTab("posts")}
        >
          <Ionicons
            name={activeTab === "posts" ? "home" : "home-outline"}
            size={20}
            color={activeTab === "posts" ? colors.card : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "posts" && styles.activeTabText,
            ]}
          >
            Posts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "reels" && styles.activeTab]}
          onPress={() => setActiveTab("reels")}
        >
          <Ionicons
            name={activeTab === "reels" ? "play-circle" : "play-circle-outline"}
            size={20}
            color={activeTab === "reels" ? colors.card : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "reels" && styles.activeTabText,
            ]}
          >
            Reels
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "nearby" && styles.activeTab]}
          onPress={() => setActiveTab("nearby")}
        >
          <Ionicons
            name={activeTab === "nearby" ? "location" : "location-outline"}
            size={20}
            color={activeTab === "nearby" ? colors.card : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "nearby" && styles.activeTabText,
            ]}
          >
            Nearby
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // Render different content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case "posts":
        return (
          <FlatList
            data={filteredPosts}
            renderItem={({ item }) => <PostItem item={item} />}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshing={loading}
            onRefresh={() => {
              fetchPosts();
              if (userLocation) fetchNearbyPosts();
            }}
          />
        );

      case "reels":
        return (
          <FlatList
            data={reels}
            renderItem={({ item }) => <ReelItem item={item} />}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.reelsContent}
            refreshing={loading}
            onRefresh={fetchReels}
            pagingEnabled
            snapToAlignment="start"
            decelerationRate="fast"
          />
        );

      case "nearby":
        return (
          <FlatList
            data={filteredPosts}
            renderItem={({ item }) => (
              <View>
                <PostItem item={item} />
                {item.distance && (
                  <Text style={styles.nearbyDistance}>
                    📍 {item.distance.toFixed(1)}km away
                  </Text>
                )}
              </View>
            )}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshing={loading}
            onRefresh={fetchNearbyPosts}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons
                  name="location-outline"
                  size={64}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyStateTitle}>
                  {userLocation
                    ? "No nearby posts"
                    : "Location access required"}
                </Text>
                <Text style={styles.emptyStateText}>
                  {userLocation
                    ? "Posts from your location will appear here"
                    : "Enable location services to see nearby posts"}
                </Text>
                {!userLocation && (
                  <TouchableOpacity
                    style={styles.enableLocationButton}
                    onPress={() => {
                      // Re-request location permission
                      Location.requestForegroundPermissionsAsync();
                    }}
                  >
                    <Text style={styles.enableLocationText}>
                      Enable Location
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Message Notification Popup */}
      {newMessageNotification?.show && (
        <TouchableOpacity
          style={styles.popupNotification}
          onPress={handleNotificationPress}
        >
          <View style={styles.notificationContent}>
            <Image
              source={{
                uri:
                  newMessageNotification.message.sender?.profilePicture ||
                  "https://via.placeholder.com/40x40/007AFF/FFFFFF?text=U",
              }}
              style={styles.notificationAvatar}
            />
            <View style={styles.notificationTextContainer}>
              <Text style={styles.notificationName}>
                {newMessageNotification.message.sender?.name || "User"}
              </Text>
              <Text style={styles.notificationMessage} numberOfLines={1}>
                {newMessageNotification.message.content}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setNewMessageNotification(null)}>
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Enhanced Header */}
      <View style={styles.appHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.appTitle}>SmartConnect</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.messageIcon}
            onPress={navigateToMessages}
          >
            <Ionicons
              name="paper-plane-outline"
              size={22}
              color={colors.text}
            />
            {unreadMessageCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>
                  {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <SearchBar />

      {/* Stories Section - Only show on Posts tab */}
      {activeTab === "posts" && (
        <View style={styles.storiesSection}>
          <FlatList
            data={stories}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.storyContainer}>
                <View
                  style={[
                    styles.storyCircle,
                    item.hasNewStory ? styles.hasNewStory : styles.seenStory,
                  ]}
                >
                  <Image
                    source={{ uri: item.avatar }}
                    style={styles.storyImage}
                  />
                  {item.isUser && (
                    <TouchableOpacity style={styles.addStoryButton}>
                      <Text style={styles.addStoryText}>+</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.storyUsername} numberOfLines={1}>
                  {item.isUser ? "Your Story" : item.name}
                </Text>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.storiesList}
          />
        </View>
      )}

      {/* Tab Navigation */}
      <TabNavigation />

      {/* Main Content */}
      {renderContent()}

      {/* Comments Modal */}
      <Modal
        visible={commentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.commentsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={selectedPost?.commentsList || []}
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentName}>{item.name}</Text>
                    <Text style={styles.commentTime}>{item.time}</Text>
                  </View>
                  <Text style={styles.commentText}>{item.comment}</Text>
                </View>
              )}
              keyExtractor={(item) => item.id}
              style={styles.commentsList}
            />

            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                value={newComment}
                onChangeText={setNewComment}
                multiline
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity
                style={[
                  styles.commentSubmitButton,
                  !newComment.trim() && styles.commentSubmitDisabled,
                ]}
                onPress={() =>
                  selectedPost &&
                  addComment(selectedPost._id || selectedPost.id)
                }
                disabled={!newComment.trim()}
              >
                <Text style={styles.commentSubmitText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Options Modal */}
      <Modal
        visible={optionsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setOptionsModalVisible(false)}
        >
          <View style={styles.optionsModal}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => downloadImage(selectedPostForOptions)}
            >
              <Text style={styles.optionText}>📥 Download Image</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                selectedPostForOptions && sharePost(selectedPostForOptions);
                setOptionsModalVisible(false);
              }}
            >
              <Text style={styles.optionText}>📤 Share Post</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                Alert.alert("Report", "Post reported successfully.");
                setOptionsModalVisible(false);
              }}
            >
              <Text style={[styles.optionText, styles.reportOption]}>
                🚨 Report Post
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionButton, styles.cancelButton]}
              onPress={() => setOptionsModalVisible(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
