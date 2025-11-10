import { useThemeStyles } from '@/hooks/useThemeStyles';
import {
  Carattere_400Regular,
  useFonts,
} from '@expo-google-fonts/carattere';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = 'http://localhost:3000';

type User = {
  _id: string;
  name: string;
  email: string;
  username: string;
  profilePicture?: string;
};

type FriendRequest = {
  _id: string;
  requesterId: string;
  recipientId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  requester?: User;
  recipient?: User;
};

type Friend = {
  _id: string;
  user: User;
  isOnline?: boolean;
};

export default function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [fontsLoaded] = useFonts({
    Carattere: Carattere_400Regular,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [newFriendUsername, setNewFriendUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  
  const { colors, isDark } = useThemeStyles();
  const { getAuthHeaders, user } = useAuth();
  const router = useRouter();

  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);

  const styles = createStyles(colors, fontsLoaded || false);

  // Load initial data
  useEffect(() => {
    loadFriendRequests();
    loadFriends();
  }, []);

  // Search users when query changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const loadFriendRequests = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/friends/requests`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setFriendRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error loading friend requests:', error);
      Alert.alert('Error', 'Failed to load friend requests');
    }
  };

  const loadFriends = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/friends`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error('Error loading friends:', error);
      Alert.alert('Error', 'Failed to load friends');
    }
  };

  const searchUsers = async () => {
    try {
      setSearching(true);
      const headers = await getAuthHeaders();
      
      // Try the alternative endpoint
      const response = await fetch(`${API_BASE_URL}/users/search/${encodeURIComponent(searchQuery)}`, {
        headers,
      });

      console.log('Search response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Search results:', data.users);
        setSearchResults(data.users || []);
      } else {
        console.log('Search failed with status:', response.status);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (friendId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/friends/${friendId}`, {
        method: 'POST',
        headers,
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Friend request sent successfully');
        setSearchResults(prev => prev.filter(user => user._id !== friendId));
      } else {
        Alert.alert('Error', data.message || 'Failed to send friend request');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/friends/${requestId}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'accept' }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Friend request accepted');
        setFriendRequests(prev => prev.filter(req => req._id !== requestId));
        loadFriends(); 
      } else {
        Alert.alert('Error', data.message || 'Failed to accept friend request');
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/friends/${requestId}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reject' }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Friend request declined');
        setFriendRequests(prev => prev.filter(req => req._id !== requestId));
      } else {
        Alert.alert('Error', data.message || 'Failed to decline friend request');
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
      Alert.alert('Error', 'Failed to decline friend request');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    Alert.alert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const headers = await getAuthHeaders();
              const response = await fetch(`${API_BASE_URL}/friends/${friendId}`, {
                method: 'DELETE',
                headers,
              });

              const data = await response.json();

              if (response.ok) {
                Alert.alert('Success', 'Friend removed successfully');
                setFriends(prev => prev.filter(friend => friend.user._id !== friendId));
              } else {
                Alert.alert('Error', data.message || 'Failed to remove friend');
              }
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          },
        },
      ]
    );
  };

  const startConversation = async (recipientId: string) => {
    try {
      const authHeaders = await getAuthHeaders();
      const headers = {
        ...authHeaders,
        'Content-Type': 'application/json',
      };
      console.log("recipient id", recipientId);
      
      const response = await fetch(`${API_BASE_URL}/conversations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ recipientId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          router.push(`/chat/${data.conversation._id}?participantId=${recipientId}`);
        }
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.message || 'Failed to start conversation');
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation');
    }
  };

  // Navigate to user profile
  const navigateToUserProfile = (userId: string) => {
    router.push(`/UserProfileScreen?userId=${userId}`);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFriendRequests(), loadFriends()]);
    setRefreshing(false);
  };

  const renderFriendRequest = (request: FriendRequest) => {
    const requester = request.requester;
    if (!requester) return null;

    return (
      <TouchableOpacity 
        key={request._id} 
        style={styles.requestItem}
        onPress={() => navigateToUserProfile(requester._id)}
      >
        <View style={styles.requestLeft}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: requester.profilePicture || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face' }} 
              style={styles.avatar}
            />
          </View>
          <View style={styles.requestInfo}>
            <Text style={styles.requestName}>{requester.name}</Text>
            <Text style={styles.requestUsername}>@{requester.username}</Text>
            <Text style={styles.requestTime}>
              {new Date(request.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
        
        <View style={styles.requestActions}>
          <TouchableOpacity 
            style={styles.acceptButton}
            onPress={(e) => {
              e.stopPropagation();
              handleAcceptRequest(request._id);
            }}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.declineButton}
            onPress={(e) => {
              e.stopPropagation();
              handleDeclineRequest(request._id);
            }}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFriend = (friend: Friend) => (
    <TouchableOpacity 
      key={friend._id} 
      style={styles.friendItem}
      onPress={() => navigateToUserProfile(friend.user._id)}
    >
      <View style={styles.friendLeft}>
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: friend.user.profilePicture || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face' }} 
            style={styles.avatar}
          />
          {friend.isOnline && <View style={styles.onlineIndicator} />}
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{friend.user.name}</Text>
          <Text style={styles.friendUsername}>@{friend.user.username}</Text>
          <Text style={[styles.friendStatus, { color: friend.isOnline ? colors.success : colors.textSecondary }]}>
            {friend.isOnline ? 'Online now' : 'Last seen 2h ago'}
          </Text>
        </View>
      </View>
      
      <View style={styles.friendActions}>
        <TouchableOpacity 
          style={styles.messageButton}
          onPress={(e) => {
            e.stopPropagation();
            startConversation(friend.user._id);
          }}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.moreButton}
          onPress={(e) => {
            e.stopPropagation();
            handleRemoveFriend(friend.user._id);
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderSearchResult = (user: User) => (
    <TouchableOpacity 
      key={user._id} 
      style={styles.searchResultItem}
      onPress={() => navigateToUserProfile(user._id)}
    >
      <View style={styles.friendLeft}>
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: user.profilePicture || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face' }} 
            style={styles.avatar}
          />
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{user.name}</Text>
          <Text style={styles.friendUsername}>@{user.username}</Text>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.addFriendButton}
        onPress={(e) => {
          e.stopPropagation();
          sendFriendRequest(user._id);
        }}
      >
        <Ionicons name="person-add-outline" size={20} color={colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderAddFriendModal = () => (
    <Modal
      visible={showAddFriendModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAddFriendModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <TouchableOpacity onPress={() => setShowAddFriendModal(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.modalDescription}>
            Search for users by username or email
          </Text>
          
          <TextInput
            style={styles.modalInput}
            placeholder="Enter username or email..."
            placeholderTextColor={colors.textSecondary}
            value={newFriendUsername}
            onChangeText={setNewFriendUsername}
            autoCapitalize="none"
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowAddFriendModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.sendButton, !newFriendUsername.trim() && styles.disabledButton]}
              onPress={() => {
                setSearchQuery(newFriendUsername);
                setShowAddFriendModal(false);
              }}
              disabled={!newFriendUsername.trim()}
            >
              <Text style={styles.sendButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header - Similar to HomeScreen */}
      <View style={styles.appHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.appTitle}>SmartConnect</Text>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowAddFriendModal(true)}
          >
            <Ionicons name="person-add-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searching && <ActivityIndicator size="small" color={colors.primary} />}
        </View>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <View style={styles.searchResultsSection}>
            <Text style={styles.sectionTitle}>Search Results</Text>
            {searchResults.map(renderSearchResult)}
          </View>
        )}

        {/* Tab Bar */}
        {!searchQuery && (
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
              onPress={() => setActiveTab('friends')}
            >
              <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
                Friends ({friends.length})
              </Text>
              {activeTab === 'friends' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
              onPress={() => setActiveTab('requests')}
            >
              <View style={styles.tabWithBadge}>
                <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
                  Requests
                </Text>
                {friendRequests.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{friendRequests.length}</Text>
                  </View>
                )}
              </View>
              {activeTab === 'requests' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        {searchQuery ? (
          searchResults.length === 0 && !searching && (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyStateTitle}>No users found</Text>
              <Text style={styles.emptyStateText}>
                Try searching with different keywords
              </Text>
            </View>
          )
        ) : activeTab === 'requests' ? (
          <View style={styles.requestsSection}>
            <Text style={styles.sectionTitle}>
              Friend Requests ({friendRequests.length})
            </Text>
            {friendRequests.length > 0 ? (
              friendRequests.map(renderFriendRequest)
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
                <Text style={styles.emptyStateTitle}>No friend requests</Text>
                <Text style={styles.emptyStateText}>
                  When you have friend requests, they'll appear here
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.friendsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Your Friends ({friends.length})
              </Text>
            </View>
            
            {friends.length > 0 ? (
              friends.map(renderFriend)
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
                <Text style={styles.emptyStateTitle}>No friends yet</Text>
                <Text style={styles.emptyStateText}>
                  Start adding friends to see them here
                </Text>
                <TouchableOpacity 
                  style={styles.addFriendCta}
                  onPress={() => setShowAddFriendModal(true)}
                >
                  <Text style={styles.addFriendCtaText}>Add Your First Friend</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {renderAddFriendModal()}
    </SafeAreaView>
  );
}

const createStyles = (colors: any, fontsLoaded: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  // New Header Styles (Similar to HomeScreen)
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 32,
    fontFamily: fontsLoaded ? 'Carattere' : 'System',
    color: colors.primary,
    marginLeft: 8,
    includeFontPadding: false,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addButton: {
    padding: 8,
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Rest of the styles remain the same
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    margin: 16,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
  searchResultsSection: {
    padding: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  addFriendButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    position: 'relative',
  },
  tabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeTab: {},
  tabText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  activeTabText: {
    color: colors.text,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 2,
    backgroundColor: colors.primary,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  requestsSection: {
    padding: 16,
  },
  friendsSection: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  requestLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  requestUsername: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  requestTime: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: colors.success,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  declineButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  friendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  friendUsername: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 2,
  },
  friendStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageButton: {
    padding: 8,
    marginRight: 8,
  },
  moreButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  addFriendCta: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFriendCtaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    color: colors.text,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: colors.border,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});