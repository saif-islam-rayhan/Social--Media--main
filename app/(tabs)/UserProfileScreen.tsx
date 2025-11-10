import { useThemeStyles } from '@/hooks/useThemeStyles';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face';
const API_BASE_URL = 'http://localhost:3000';

type User = {
  _id: string;
  name: string;
  username: string;
  profilePicture: string;
  bio: string;
  isProfileComplete: boolean;
  postsCount: number;
  friendsCount: number;
  isFriend: boolean;
};

type Post = {
  _id: string;
  userId: string;
  user?: User;
  content: string;
  image?: string;
  privacy: 'public' | 'friends' | 'private';
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
};

type Friend = {
  _id: string;
  user: User;
  isOnline?: boolean;
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  actionButton: {
    padding: 8,
  },
  profileContainer: {
    backgroundColor: colors.surface,
  },
  profileHeader: {
    padding: 20,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  userBio: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dangerButton: {
    flex: 1,
    backgroundColor: colors.error,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  post: {
    backgroundColor: colors.surface,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userInfoSmall: {
    flex: 1,
  },
  name: {
    fontWeight: '600',
    fontSize: 15,
    color: colors.text,
    marginBottom: 2,
  },
  username: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  privacyBadge: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  content: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontWeight: '400',
  },
  postImage: {
    width: '100%',
    height: 300,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  actionText: {
    marginLeft: 6,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  likedAction: {
    color: colors.primary,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  friendUsername: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  privacyRestrictedView: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.background,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  privacyRestrictedText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});

type TabType = 'posts' | 'friends';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useThemeStyles();
  const styles = createStyles(colors);
  const { getAuthHeaders, user: currentUser } = useAuth();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Helper function to format time
  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  // Get privacy badge text
  const getPrivacyBadge = (privacy: string) => {
    switch (privacy) {
      case 'public': return '🌍 Public';
      case 'friends': return '👥 Friends';
      case 'private': return '🔒 Private';
      default: return '';
    }
  };

  // Check if current user can view post
  const canViewPost = (post: Post) => {
    if (!currentUser || !profileUser) return false;
    
    // User can always view their own posts
    if (post.userId === currentUser.id) return true;
    
    // For friends privacy, check if users are friends
    if (post.privacy === 'friends') {
      return profileUser.isFriend || post.userId === currentUser.id;
    }
    
    // For public posts, anyone can view
    if (post.privacy === 'public') return true;
    
    // For private posts, only owner can view
    return false;
  };

  // Fetch user profile
  const fetchUserProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        credentials: 'include',
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setProfileUser(data.user);
      } else {
        throw new Error(data.message || 'Failed to load user profile');
      }
    } catch (err: any) {
      console.error('Error fetching user profile:', err);
      setError(err.message || 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [userId, getAuthHeaders]);

  // Fetch user's posts
  const fetchUserPosts = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/posts?userId=${userId}`, {
        credentials: 'include',
        headers: headers
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPosts(data.posts || []);
        }
      }
    } catch (error) {
      console.error('Error fetching user posts:', error);
    }
  };
if (!currentUser) {
  return; // or show login prompt, or safely skip the action
}
  // Fetch user's friends
  const fetchUserFriends = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/users/${userId}/friends`, {
        credentials: 'include',
        headers: headers
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFriends(data.friends || []);
        }
      }
    } catch (error) {
      console.error('Error fetching user friends:', error);
    }
  };

// Send friend request - CORRECTED
const sendFriendRequest = async () => {
  try {
    setActionLoading(true);
    
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/friends/${userId}`, { // POST to /friends/:friendId
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}) // No body needed for this endpoint
    });

    const data = await response.json();

    if (response.ok && data.success) {
      Alert.alert('Success', 'Friend request sent successfully');
      // Refresh profile to update friend status
      fetchUserProfile();
    } else {
      throw new Error(data.message || 'Failed to send friend request');
    }
  } catch (error: any) {
    console.error('Error sending friend request:', error);
    Alert.alert('Error', error.message || 'Failed to send friend request');
  } finally {
    setActionLoading(false);
  }
};

// Remove friend - CORRECTED
const removeFriend = async () => {
  try {
    setActionLoading(true);
    
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/friends/${userId}`, { // DELETE to /friends/:friendId
      method: 'DELETE',
      headers: headers
    });

    const data = await response.json();

    if (response.ok && data.success) {
      Alert.alert('Success', 'Friend removed successfully');
      // Refresh profile to update friend status
      fetchUserProfile();
    } else {
      throw new Error(data.message || 'Failed to remove friend');
    }
  } catch (error: any) {
    console.error('Error removing friend:', error);
    Alert.alert('Error', error.message || 'Failed to remove friend');
  } finally {
    setActionLoading(false);
  }
};

  // Like/Unlike post
  const likePost = async (postId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/like`, {
        method: "POST",
        headers: headers,
      });

      const data = await response.json();

      if (response.ok && data.success) {
      

setPosts(prevPosts =>
  prevPosts.map(post => {
    if (post._id === postId) {
      const hasLiked = post.likes.some(like => like.userId === currentUser.id);
      return {
        ...post,
        likes: hasLiked
          ? post.likes.filter(like => like.userId !== currentUser.id)
          : [...post.likes, { userId: currentUser.id, likedAt: new Date().toISOString() }]
      } as Post;
    }
    return post;
  })
);

      } else {
        throw new Error(data.message || "Failed to like post");
      }
    } catch (error: any) {
      console.error("Error liking post:", error);
      Alert.alert("Error", "Failed to like post");
    }
  };

  // Load all data
  const loadData = async () => {
    await Promise.all([
      fetchUserProfile(),
      fetchUserPosts(),
    ]);
  };

  // Load data when component mounts or userId changes
  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId, fetchUserProfile]);

  // Load friends when tab changes
  useEffect(() => {
    if (activeTab === 'friends' && profileUser) {
      fetchUserFriends();
    }
  }, [activeTab, profileUser]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderPost = ({ item }: { item: Post }) => {
    const canView = canViewPost(item);
    const isLiked = item.likes.some(like => like.userId === currentUser?.id);

    if (!canView && item.privacy !== 'public') {
      return (
        <View style={styles.post}>
          <View style={styles.postHeader}>
            <Image 
              source={{ uri: profileUser?.profilePicture || DEFAULT_AVATAR }} 
              style={styles.userAvatar}
            />
            <View style={styles.userInfoSmall}>
              <Text style={styles.name}>{profileUser?.name}</Text>
              <Text style={styles.username}>@{profileUser?.username}</Text>
              <Text style={styles.privacyBadge}>{getPrivacyBadge(item.privacy)}</Text>
            </View>
          </View>
          <View style={styles.privacyRestrictedView}>
            <Ionicons name="lock-closed" size={24} color={colors.textSecondary} />
            <Text style={styles.privacyRestrictedText}>
              This {item.privacy === 'friends' ? 'friends' : 'private'} post is not available
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.post}>
        <View style={styles.postHeader}>
          <Image 
            source={{ uri: profileUser?.profilePicture || DEFAULT_AVATAR }} 
            style={styles.userAvatar}
          />
          <View style={styles.userInfoSmall}>
            <Text style={styles.name}>{profileUser?.name}</Text>
            <Text style={styles.username}>@{profileUser?.username} · {getTimeAgo(item.createdAt)}</Text>
            <Text style={styles.privacyBadge}>{getPrivacyBadge(item.privacy)}</Text>
          </View>
        </View>
        
        <Text style={styles.content}>{item.content}</Text>
        
        {item.image && (
          <Image source={{ uri: item.image }} style={styles.postImage} resizeMode="cover" />
        )}
        
        <View style={styles.postActions}>
          <TouchableOpacity 
            onPress={() => likePost(item._id)} 
            style={styles.action}
          >
            <Text style={[styles.actionText, isLiked && styles.likedAction]}>
              {isLiked ? '❤️' : '🤍'} {item.likes.length}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.action}>
            <Text style={styles.actionText}>💬 {item.comments.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.action}>
            <Text style={styles.actionText}>📤 {item.shares}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <TouchableOpacity 
      style={styles.friendItem}
      onPress={() => router.push(`/user-profile?userId=${item.user._id}`)}
    >
      <Image 
        source={{ uri: item.user.profilePicture || DEFAULT_AVATAR }} 
        style={styles.friendAvatar}
      />
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.user.name}</Text>
        <Text style={styles.friendUsername}>@{item.user.username}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!profileUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>User not found</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnProfile = currentUser?.id === userId;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
      >
        {/* Profile Info */}
        <View style={styles.profileContainer}>
          <View style={styles.profileHeader}>
            <View style={styles.profileInfo}>
              <View style={styles.avatarContainer}>
                <Image 
                  source={{ uri: profileUser.profilePicture || DEFAULT_AVATAR }} 
                  style={styles.avatar}
                />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{profileUser.name}</Text>
                <Text style={styles.userUsername}>@{profileUser.username}</Text>
                {profileUser.bio ? (
                  <Text style={styles.userBio}>{profileUser.bio}</Text>
                ) : (
                  <Text style={[styles.userBio, { color: colors.textSecondary }]}>
                    No bio yet
                  </Text>
                )}
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{profileUser.postsCount}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{profileUser.friendsCount}</Text>
                <Text style={styles.statLabel}>Friends</Text>
              </View>
            </View>

            {/* Action Buttons */}
            {!isOwnProfile && (
              <View style={styles.actionButtons}>
                {profileUser.isFriend ? (
                  <TouchableOpacity 
                    style={[styles.dangerButton, actionLoading && styles.disabledButton]}
                    onPress={removeFriend}
                    disabled={actionLoading}
                  >
                    <Ionicons name="person-remove-outline" size={20} color="#fff" />
                    <Text style={styles.buttonText}>
                      {actionLoading ? 'Removing...' : 'Remove Friend'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={[styles.primaryButton, actionLoading && styles.disabledButton]}
                    onPress={sendFriendRequest}
                    disabled={actionLoading}
                  >
                    <Ionicons name="person-add-outline" size={20} color="#fff" />
                    <Text style={styles.buttonText}>
                      {actionLoading ? 'Sending...' : 'Add Friend'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.secondaryButton}>
                  <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
                  <Text style={styles.secondaryButtonText}>Message</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
              onPress={() => setActiveTab('posts')}
            >
              <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>
                Posts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
              onPress={() => setActiveTab('friends')}
            >
              <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
                Friends
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {activeTab === 'posts' ? (
            posts.length > 0 ? (
              <FlatList
                data={posts}
                renderItem={renderPost}
                keyExtractor={item => item._id}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
                <Text style={styles.emptyStateText}>
                  {isOwnProfile ? 'You haven' : `${profileUser.name} hasn'`}t posted anything yet
                </Text>
              </View>
            )
          ) : (
            friends.length > 0 ? (
              <FlatList
                data={friends}
                renderItem={renderFriend}
                keyExtractor={item => item._id}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
                <Text style={styles.emptyStateText}>
                  {isOwnProfile ? 'You don' : `${profileUser.name} doesn'`}t have any friends yet
                </Text>
              </View>
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}