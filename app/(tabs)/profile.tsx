import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useThemeStyles } from "../../hooks/useThemeStyles";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

// Types for posts
interface Post {
  _id: string;
  userId: string;
  content: string;
  image?: string;
  privacy: string;
  likes: Array<{ userId: string; likedAt: string }>;
  comments: Array<any>;
  shares: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    _id: string;
    fullName: string;
    profilePicture?: string;
    coverPhoto?: string;
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { colors, isDark } = useThemeStyles();
  const { user, getAuthHeaders, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"posts" | "videos" | "photos">(
    "posts"
  );
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingType, setUploadingType] = useState<"profile" | "cover" | null>(null);

  const API_BASE_URL = "http://localhost:3000";

  // Request permissions on component mount
  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission required",
            "Sorry, we need camera roll permissions to upload images."
          );
        }
      }
    })();
  }, []);

  // Fetch posts from API
  const fetchPosts = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/posts?limit=20`, {
        method: "GET",
        headers: headers as HeadersInit,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Filter posts to show only current user's posts
        const userPosts = data.posts.filter(
          (post: Post) =>
            post.user?._id === user?.id || post.userId === user?.id
        );
        setPosts(userPosts);
      } else {
        throw new Error(data.message || "Failed to fetch posts");
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      Alert.alert("Error", "Failed to load posts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Simple upload profile image - directly opens gallery
  const uploadProfileImage = async () => {
    try {
      setUploading(true);
      setUploadingType("profile");

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0] && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        
        const headers = await getAuthHeaders();
        
        // First upload to imgBB
        const uploadResponse = await fetch(`${API_BASE_URL}/upload`, {
          method: "POST",
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          } as HeadersInit,
          body: JSON.stringify({ image: base64Image }),
        });

        const uploadData = await uploadResponse.json();

        if (uploadResponse.ok && uploadData.success) {
          // Then update profile with the returned URL
          const profileResponse = await fetch(`${API_BASE_URL}/profile`, {
            method: "PUT",
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            } as HeadersInit,
            body: JSON.stringify({
              profilePicture: uploadData.url
            }),
          });

          const profileData = await profileResponse.json();

          if (profileResponse.ok && profileData.success) {
            // Update user context with new profile picture
            if (updateUser) {
              updateUser({ 
                profilePicture: profileData.user.profilePicture,
                isProfileComplete: profileData.isProfileComplete 
              });
            }
            Alert.alert("Success", "Profile picture updated successfully!");
          } else {
            throw new Error(profileData.message || "Failed to update profile");
          }
        } else {
          throw new Error(uploadData.message || "Failed to upload image");
        }
      }
    } catch (error: any) {
      console.error("Error uploading profile image:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to upload profile picture. Please try again."
      );
    } finally {
      setUploading(false);
      setUploadingType(null);
    }
  };

  // Upload cover photo
  const uploadCoverPhoto = async () => {
    try {
      setUploading(true);
      setUploadingType("cover");

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0] && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        
        const headers = await getAuthHeaders();
        
        // First upload to imgBB
        const uploadResponse = await fetch(`${API_BASE_URL}/upload`, {
          method: "POST",
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          } as HeadersInit,
          body: JSON.stringify({ image: base64Image }),
        });

        const uploadData = await uploadResponse.json();

        if (uploadResponse.ok && uploadData.success) {
          // Then update profile with the returned URL
          const profileResponse = await fetch(`${API_BASE_URL}/profile`, {
            method: "PUT",
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            } as HeadersInit,
            body: JSON.stringify({
              coverPhoto: uploadData.url
            }),
          });

          const profileData = await profileResponse.json();

          if (profileResponse.ok && profileData.success) {
            // Update user context with new cover photo
            if (updateUser) {
              updateUser({ 
                coverPhoto: profileData.user.coverPhoto 
              });
            }
            Alert.alert("Success", "Cover photo updated successfully!");
          } else {
            throw new Error(profileData.message || "Failed to update profile");
          }
        } else {
          throw new Error(uploadData.message || "Failed to upload image");
        }
      }
    } catch (error: any) {
      console.error("Error uploading cover photo:", error);
      Alert.alert("Error", "Failed to upload cover photo. Please try again.");
    } finally {
      setUploading(false);
      setUploadingType(null);
    }
  };

  // Like/Unlike post
  const handleLikePost = async (postId: string) => {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/posts/${postId}/like`, {
        method: "POST",
        headers: headers as HeadersInit,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Update local state
        setPosts((prevPosts) =>
          prevPosts.map((post) => {
            if (post._id === postId) {
              const hasLiked = post.likes.some(
                (like) => like.userId === user?.id
              );
              const updatedLikes = hasLiked
                ? post.likes.filter((like) => like.userId !== user?.id)
                : [
                    ...post.likes,
                    {
                      userId: user?.id || "",
                      likedAt: new Date().toISOString(),
                    },
                  ];

              return { ...post, likes: updatedLikes };
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

  // Delete post
  const handleDeletePost = (postId: string) => {
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const headers = await getAuthHeaders();

            const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
              method: "DELETE",
              headers: headers as HeadersInit,
            });

            const data = await response.json();

            if (response.ok && data.success) {
              // Remove from local state
              setPosts((prevPosts) =>
                prevPosts.filter((post) => post._id !== postId)
              );
              Alert.alert("Success", "Post deleted successfully");
            } else {
              throw new Error(data.message || "Failed to delete post");
            }
          } catch (error) {
            console.error("Error deleting post:", error);
            Alert.alert("Error", "Failed to delete post");
          }
        },
      },
    ]);
  };

  // Share post
  const handleSharePost = async (postId: string) => {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/posts/${postId}/share`, {
        method: "POST",
        headers: headers as HeadersInit,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert("Success", "Post shared successfully");
        // Refresh posts to get updated share count
        fetchPosts();
      } else {
        throw new Error(data.message || "Failed to share post");
      }
    } catch (error) {
      console.error("Error sharing post:", error);
      Alert.alert("Error", "Failed to share post");
    }
  };

  // Pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const latestFriends = [
    {
      id: "1",
      name: "Sarah Smith",
      avatar:
        "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face",
      mutualFriends: 12,
    },
  ];

  const userPhotos = [
    {
      id: "1",
      type: "photo",
      uri: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=300&h=300&fit=crop",
    },
  ];

  const userVideos = [
    {
      id: "1",
      type: "video",
      uri: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300&h=300&fit=crop",
      duration: "2:30",
      views: "12K",
    },
  ];

  const handleFriendPress = (friend: any) => {
    router.push(`/profile/${friend.id}`);
  };

  const handleViewAllFriends = () => {
    router.push("/friends");
  };

  const userStats = {
    posts: posts.length,
    followers: 12500,
    following: 456,
    photos: 89,
    videos: 23,
  };

  const styles = createStyles(colors);

  const handleEditProfile = () => {
    router.push("/edit-profile");
  };

  // Render actual posts from API
  const renderPostItem = ({ item }: { item: Post }) => {
    const hasLiked = item.likes.some((like) => like.userId === user?.id);
    const displayName = item.user?.fullName || user?.fullName || "User";
    const profilePicture =
      item.user?.profilePicture ||
      user?.profilePicture ||
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face";

    return (
      <View style={styles.postCard}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          <Image source={{ uri: profilePicture }} style={styles.postAvatar} />
          <View style={styles.postUserInfo}>
            <Text style={styles.postUserName}>{displayName}</Text>
            <Text style={styles.postTime}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.postMenuButton}
            onPress={() => handleDeletePost(item._id)}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Post Content */}
        {item.content ? (
          <Text style={styles.postContent}>{item.content}</Text>
        ) : null}

        {/* Post Image */}
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.postImage} />
        ) : null}

        {/* Post Stats */}
        <View style={styles.postStats}>
          <Text style={styles.postStatText}>
            {item.likes.length} likes • {item.comments.length} comments •{" "}
            {item.shares} shares
          </Text>
        </View>

        {/* Post Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.postAction}
            onPress={() => handleLikePost(item._id)}
          >
            <Ionicons
              name={hasLiked ? "heart" : "heart-outline"}
              size={20}
              color={hasLiked ? "#ff3b30" : colors.textSecondary}
            />
            <Text style={[styles.postActionText, hasLiked && styles.likedText]}>
              Like
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.postAction}>
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.postActionText}>Comment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.postAction}
            onPress={() => handleSharePost(item._id)}
          >
            <Ionicons
              name="share-outline"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.postActionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render grid item for photos/videos
  const renderGridItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.gridItem}>
      <Image source={{ uri: item.uri }} style={styles.gridImage} />
      {item.type === "video" && (
        <View style={styles.videoOverlay}>
          <Ionicons name="play-circle" size={24} color="#fff" />
          <Text style={styles.videoDuration}>{item.duration}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Fallback data for user
  const displayName = user?.fullName || "User Name";
  const username = user?.username || "@username";
  const profilePicture =
    user?.profilePicture ||
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face";
  const coverPhoto =
    user?.coverPhoto ||
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=300&fit=crop";
  const bio =
    user?.bio || "Welcome to my profile! Connect with me to stay updated!";

  // Check if currently uploading
  const isUploadingProfile = uploading && uploadingType === "profile";
  const isUploadingCover = uploading && uploadingType === "cover";

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerUserInfo}>
          <Text
            style={styles.headerName}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayName}
          </Text>
          <Text style={styles.headerPosts}>{userStats.posts} posts</Text>
        </View>
        <TouchableOpacity style={styles.settingsButton}>
          <Ionicons name="search" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
      >
        {/* Cover Photo & Profile Section */}
        <View style={styles.coverSection}>
          {/* Cover Photo with Upload Button */}
          <View style={styles.coverPhotoContainer}>
            <Image source={{ uri: coverPhoto }} style={styles.coverPhoto} />
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={uploadCoverPhoto}
              disabled={uploading}
            >
              {isUploadingCover ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Profile Image positioned over cover photo with Upload Button */}
          <View style={styles.profileImageOverlay}>
            <View style={styles.profileImageContainer}>
              <Image
                source={{ uri: profilePicture }}
                style={styles.profileImage}
              />
              <TouchableOpacity
                style={styles.profileImageBadge}
                onPress={uploadProfileImage} 
                disabled={uploading}
                activeOpacity={0.7}
              >
                {isUploadingProfile ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={14} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Profile Info Section */}
          <View style={styles.profileInfoSection}>
            <View style={styles.profileMainInfo}>
              <Text
                style={styles.profileName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {displayName}
              </Text>
              <Text
                style={styles.profileHandle}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {username}
              </Text>
              <Text
                style={styles.profileBio}
                numberOfLines={3}
                ellipsizeMode="tail"
              >
                {bio}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleEditProfile}
            >
              <Ionicons name="create-outline" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton}>
              <Ionicons name="share-outline" size={18} color={colors.text} />
              <Text style={styles.secondaryButtonText}>Share Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreButton}>
              <Ionicons
                name="ellipsis-horizontal"
                size={18}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>

          {/* Friends Section */}
          <View style={styles.friendsSection}>
            <View style={styles.friendsHeader}>
              <Text style={styles.friendsTitle}>Friends</Text>
            </View>
            <View style={styles.friendsGrid}>
              {latestFriends.map((friend) => (
                <TouchableOpacity
                  key={friend.id}
                  style={styles.friendCard}
                  onPress={() => handleFriendPress(friend)}
                >
                  <Image
                    source={{ uri: friend.avatar }}
                    style={styles.friendImage}
                  />
                  <Text style={styles.friendName} numberOfLines={1}>
                    {friend.name}
                  </Text>
                  <View style={styles.mutualFriends}>
                    <Text style={styles.mutualFriendsText}>
                      {friend.mutualFriends} mutual friends
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.seeAllButton}
              onPress={handleViewAllFriends}
            >
              <Text style={styles.seeAllText}>See All Friends</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "posts" && styles.activeTab]}
            onPress={() => setActiveTab("posts")}
          >
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
            style={[styles.tab, activeTab === "photos" && styles.activeTab]}
            onPress={() => setActiveTab("photos")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "photos" && styles.activeTabText,
              ]}
            >
              Photos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "videos" && styles.activeTab]}
            onPress={() => setActiveTab("videos")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "videos" && styles.activeTabText,
              ]}
            >
              Videos
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content Sections */}
        {activeTab === "posts" && (
          <View style={styles.postsContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.loadingText}>Loading posts...</Text>
              </View>
            ) : posts.length > 0 ? (
              <FlatList
                data={posts}
                renderItem={renderPostItem}
                keyExtractor={(item) => item._id}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.postsContent}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons
                  name="newspaper-outline"
                  size={64}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyStateText}>No posts yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Share your first post with your friends!
                </Text>
              </View>
            )}
          </View>
        )}

        {activeTab === "photos" && (
          <View style={styles.gridContainer}>
            <FlatList
              data={userPhotos}
              renderItem={renderGridItem}
              keyExtractor={(item) => item.id}
              numColumns={3}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.gridContent}
            />
          </View>
        )}

        {activeTab === "videos" && (
          <View style={styles.gridContainer}>
            <FlatList
              data={userVideos}
              renderItem={renderGridItem}
              keyExtractor={(item) => item.id}
              numColumns={3}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.gridContent}
            />
          </View>
        )}

        {/* Footer Spacer */}
        <View style={styles.footerSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");
const gridItemSize = (width - 4) / 3;

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    backButton: {
      padding: 4,
    },
    headerUserInfo: {
      alignItems: "center",
      flex: 1,
      marginHorizontal: 16,
    },
    headerName: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.text,
      textAlign: "center",
      maxWidth: "80%",
    },
    headerPosts: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    settingsButton: {
      padding: 4,
    },
    scrollView: {
      flex: 1,
    },
    coverSection: {
      backgroundColor: colors.surface,
    },
    coverPhotoContainer: {
      height: 160,
      position: "relative",
    },
    coverPhoto: {
      width: "100%",
      height: "100%",
    },
    cameraButton: {
      position: "absolute",
      bottom: 16,
      right: 16,
      backgroundColor: "rgba(0,0,0,0.6)",
      padding: 8,
      borderRadius: 20,
      width: 36,
      height: 36,
      justifyContent: "center",
      alignItems: "center",
    },
    profileImageOverlay: {
      position: "absolute",
      top: 120,
      left: 16,
      zIndex: 1000,
    },
    profileImageContainer: {
      position: "relative",
    },
    profileImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 4,
      borderColor: colors.surface,
    },
    profileImageBadge: {
      position: "absolute",
      bottom: -5,
      right: -5,
      backgroundColor: colors.accent,
      borderRadius: 16,
      width: 36,
      height: 36,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.surface,
      zIndex: 1001,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
    },
    profileInfoSection: {
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 16,
      marginTop: 0,
    },
    profileMainInfo: {
      minWidth: 0,
      marginLeft: 0,
    },
    profileName: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "bold",
      marginBottom: 4,
      flexShrink: 1,
    },
    profileHandle: {
      color: colors.textSecondary,
      fontSize: 16,
      marginBottom: 12,
      flexShrink: 1,
    },
    profileBio: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
      flexShrink: 1,
    },
    actionButtons: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 8,
    },
    primaryButton: {
      flex: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 6,
      gap: 6,
    },
    primaryButtonText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "600",
    },
    secondaryButton: {
      flex: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "500",
    },
    moreButton: {
      padding: 10,
      backgroundColor: colors.background,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabContainer: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginVertical: 16,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 6,
    },
    activeTab: {
      backgroundColor: colors.accent,
    },
    tabText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },
    activeTabText: {
      color: "#fff",
    },
    postsContainer: {
      flex: 1,
      marginHorizontal: 16,
    },
    postsContent: {
      paddingBottom: 16,
    },
    postCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    postHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    postAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
    },
    postUserInfo: {
      flex: 1,
    },
    postUserName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    postTime: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    postMenuButton: {
      padding: 4,
    },
    postContent: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
      marginBottom: 12,
    },
    postImage: {
      width: "100%",
      height: 200,
      borderRadius: 8,
      marginBottom: 12,
      resizeMode: "cover",
    },
    postStats: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 8,
      marginBottom: 8,
    },
    postStatText: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    postActions: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    postAction: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 6,
      gap: 6,
    },
    postActionText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },
    likedText: {
      color: "#ff3b30",
    },
    loadingContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 40,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 16,
      marginTop: 12,
    },
    gridContainer: {
      flex: 1,
      marginHorizontal: 16,
    },
    gridContent: {
      paddingBottom: 16,
    },
    gridItem: {
      width: gridItemSize,
      height: gridItemSize,
      margin: 0.5,
      backgroundColor: colors.surface,
      borderRadius: 4,
      overflow: "hidden",
      position: "relative",
    },
    gridImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    videoOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.3)",
      justifyContent: "center",
      alignItems: "center",
    },
    videoDuration: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "500",
      marginTop: 2,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyStateText: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "600",
      marginTop: 16,
      marginBottom: 8,
    },
    emptyStateSubtext: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
    friendsSection: {
      backgroundColor: colors.surface,
      margin: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    friendsHeader: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    friendsTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.text,
      marginBottom: 4,
    },
    friendsCount: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    friendsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      padding: 8,
    },
    friendCard: {
      width: "33.333%",
      padding: 8,
      alignItems: "center",
    },
    friendImage: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 8,
      marginBottom: 8,
    },
    friendName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      textAlign: "center",
      marginBottom: 4,
      width: "100%",
    },
    mutualFriends: {
      paddingHorizontal: 8,
    },
    mutualFriendsText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
    },
    seeAllButton: {
      padding: 16,
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    seeAllText: {
      color: colors.accent,
      fontSize: 16,
      fontWeight: "600",
    },
    footerSpacer: {
      height: 20,
    },
  });