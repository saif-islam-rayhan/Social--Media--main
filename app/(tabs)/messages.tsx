import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { io, Socket } from "socket.io-client";
import { useThemeStyles } from "../../hooks/useThemeStyles";
import { useAuth } from "../context/AuthContext";

interface User {
  _id: string;
  name: string;
  username: string;
  profilePicture?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

interface Participant {
  _id: string;
  name: string;
  username: string;
  profilePicture?: string;
  isOnline?: boolean;
}

interface LastMessage {
  _id: string;
  content: string;
  senderId: string;
  createdAt: string;
  type: string;
}

interface Conversation {
  _id: string;
  participant: Participant;
  lastMessage?: LastMessage;
  unreadCount: number;
  updatedAt: string;
  createdAt: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasMore: boolean;
}

// Utility function to remove duplicates
const removeDuplicates = (conversations: Conversation[]): Conversation[] => {
  const seen = new Set();
  return conversations.filter(conv => {
    if (seen.has(conv._id)) {
      console.warn(`Duplicate conversation found: ${conv._id}`);
      return false;
    }
    seen.add(conv._id);
    return true;
  });
};

export default function MessagesScreen() {
  const { colors } = useThemeStyles();
  const { user, getAuthHeaders } = useAuth();
  const router = useRouter();
  const styles = createStyles(colors);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasMore: false,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // NEW: Friend search states
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchingFriends, setSearchingFriends] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<User[]>([]);

  // WebSocket state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [newMessageNotification, setNewMessageNotification] = useState<{
    show: boolean;
    conversationId: string;
    message: any;
  } | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Animation values
  const modalAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(300)).current;

  // Use ref to track conversations for the fetch function without causing re-renders
  const conversationsRef = useRef<Conversation[]>([]);
  
  // Get token from auth headers
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const authHeaders = await getAuthHeaders();
      const headers = authHeaders as Record<string, string>;
      const authKey = Object.keys(headers).find(
        key => key.toLowerCase() === 'authorization'
      );
      const authHeader = authKey ? headers[authKey] : null;
      
      if (!authHeader) {
        console.log('No Authorization header found');
        return null;
      }

      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      
      if (!token) {
        console.log('Empty token found in Authorization header');
        return null;
      }
      
      return token;
    } catch (error) {
      console.error('❌ Error getting token from auth headers:', error);
      return null;
    }
  }, [getAuthHeaders]);

  // Load token on component mount
  useEffect(() => {
    const loadToken = async () => {
      const extractedToken = await getToken();
      setToken(extractedToken);
    };
    
    loadToken();
  }, [getToken]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!token || !user) {
      console.log('WebSocket: Waiting for token or user...');
      return;
    }

    console.log("Initializing WebSocket connection with token...");
    
    const newSocket = io("http://localhost:3000", {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected successfully');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });

    // Listen for new messages
    newSocket.on('new_message', (data) => {
      console.log('New message received via WebSocket:', data);
      
      const { conversationId, message } = data;
      
      // Update conversations list with new message and move to top
      setConversations(prev => {
        const updatedConversations = prev.map(conv => {
          if (conv._id === conversationId) {
            return {
              ...conv,
              lastMessage: {
                _id: message._id,
                content: message.content,
                senderId: message.senderId,
                createdAt: message.createdAt,
                type: message.type
              },
              updatedAt: new Date().toISOString(),
              unreadCount: conv.unreadCount + 1
            };
          }
          return conv;
        });

        // Move the updated conversation to the top
        const conversationIndex = updatedConversations.findIndex(conv => conv._id === conversationId);
        if (conversationIndex > 0) {
          const [movedConversation] = updatedConversations.splice(conversationIndex, 1);
          updatedConversations.unshift(movedConversation);
        }

        return updatedConversations;
      });

      // Show popup notification
      setNewMessageNotification({
        show: true,
        conversationId,
        message
      });

      // Auto-hide notification after 3 seconds
      setTimeout(() => {
        setNewMessageNotification(null);
      }, 3000);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up WebSocket connection');
      newSocket.disconnect();
    };
  }, [token, user]);

  // NEW: Search friends function
  const searchFriends = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchingFriends(true);
      const authHeaders = await getAuthHeaders();
      
      const response = await fetch(
        `http://localhost:3000/users/search/${encodeURIComponent(query)}`,
        {
          method: "GET",
          headers: authHeaders,
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Filter out current user and already selected friends
          const filteredResults = (data.users || []).filter(
            (userResult: User) => 
              userResult._id !== user?.id && 
              !selectedFriends.some(selected => selected._id === userResult._id)
          );
          setSearchResults(filteredResults);
        }
      }
    } catch (error) {
      console.error('Error searching friends:', error);
      setSearchResults([]);
    } finally {
      setSearchingFriends(false);
    }
  }, [getAuthHeaders, user?.id, selectedFriends]);

  // NEW: Handle friend selection
  const handleSelectFriend = (friend: User) => {
    setSelectedFriends(prev => [...prev, friend]);
    setFriendSearchQuery("");
    setSearchResults([]);
  };

  // NEW: Remove selected friend
  const handleRemoveFriend = (friendId: string) => {
    setSelectedFriends(prev => prev.filter(friend => friend._id !== friendId));
  };

  // NEW: Start new conversation
  const startNewConversation = async () => {
    if (selectedFriends.length === 0) return;

    try {
      const authHeaders = await getAuthHeaders();
      
      // For now, we'll start with single participant conversations
      const participantId = selectedFriends[0]._id;
      
      const response = await fetch(
        `http://localhost:3000/conversations`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            participantId: participantId,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Close modal and navigate to chat
          closeNewMessageModal();
          router.push({
            pathname: `/chat/${data.conversation._id}`,
            params: {
              participantId: participantId,
              participantName: selectedFriends[0].name,
            },
          });
        }
      } else {
        throw new Error('Failed to create conversation');
      }
    } catch (error) {
      console.error('Error starting new conversation:', error);
     
    }
  };

  // NEW: Open new message modal with animation
  const openNewMessageModal = () => {
    setShowNewMessageModal(true);
    setSelectedFriends([]);
    setFriendSearchQuery("");
    setSearchResults([]);
    
    Animated.parallel([
      Animated.timing(modalAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // NEW: Close new message modal with animation
  const closeNewMessageModal = () => {
    Animated.parallel([
      Animated.timing(modalAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: 300,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowNewMessageModal(false);
    });
  };

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;

    return conversations.filter(
      (conv) =>
        conv.participant.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        conv.participant.username
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (conv.lastMessage?.content || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  // Fetch conversations
  const fetchConversations = useCallback(
    async (showRefresh = false, loadMore = false) => {
      try {
        setError(null);

        if (loadMore) {
          setLoadingMore(true);
        } else if (!showRefresh) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        const page = loadMore ? pagination.currentPage + 1 : 1;
        const authHeaders = await getAuthHeaders();
        const headers = {
          ...authHeaders,
          "Content-Type": "application/json",
        };

        const response = await fetch(
          `http://localhost:3000/conversations`,
          {
            method: "GET",
            headers,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch conversations: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
          const validConversations = (data.conversations || [])
            .filter((conv: any) => {
              if (!conv.participant || !conv.participant._id) {
                console.warn('Skipping conversation without participant:', conv._id);
                return false;
              }
              return true;
            })
            .map((conv: any) => {
              const userUnreadCount = conv.unreadCounts?.find(
                (uc: any) => uc.userId === user?.id
              )?.count || 0;

              let lastMessage = undefined;
              
              if (conv.lastMessage && typeof conv.lastMessage === 'object') {
                lastMessage = {
                  _id: conv.lastMessage._id || conv._id + '_msg',
                  content: conv.lastMessage.content || conv.lastMessage || "",
                  senderId: conv.lastMessage.senderId || "",
                  createdAt: conv.lastMessage.createdAt || conv.updatedAt || conv.createdAt || new Date().toISOString(),
                  type: conv.lastMessage.type || "text"
                };
              } else if (typeof conv.lastMessage === 'string') {
                lastMessage = {
                  _id: conv._id + '_msg',
                  content: conv.lastMessage,
                  senderId: "",
                  createdAt: conv.updatedAt || conv.createdAt || new Date().toISOString(),
                  type: "text"
                };
              }

              return {
                _id: conv._id,
                participant: {
                  _id: conv.participant._id,
                  name: conv.participant.name || "Unknown User",
                  username: conv.participant.username || "unknown",
                  profilePicture: conv.participant.profilePicture || undefined,
                  isOnline: conv.participant.isOnline || false
                },
                lastMessage: lastMessage,
                unreadCount: userUnreadCount,
                updatedAt: conv.updatedAt || conv.createdAt || new Date().toISOString(),
                createdAt: conv.createdAt || new Date().toISOString()
              };
            });

          const uniqueConversations = removeDuplicates(validConversations);

          const sortedConversations = uniqueConversations.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );

          if (loadMore) {
            const currentConversations = conversationsRef.current;
            const existingIds = new Set(currentConversations.map(c => c._id));
            const newConversations = sortedConversations.filter((conv: Conversation) => 
              !existingIds.has(conv._id)
            );
            setConversations((prev) => [...prev, ...newConversations]);
          } else {
            setConversations(sortedConversations);
          }

          setPagination(
            data.pagination || {
              currentPage: page,
              totalPages: 1,
              totalCount: sortedConversations.length,
              hasMore: false,
            }
          );
        } else {
          throw new Error(data.message || "Failed to load conversations");
        }
      } catch (error) {
        console.error("Error fetching conversations:", error);
        setError(
          error instanceof Error ? error.message : "Unknown error occurred"
        );
        setRetryCount((prev) => prev + 1);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [getAuthHeaders, pagination.currentPage, user?.id]
  );

  const fetchWithRetry = useCallback(
    async (attempt = 0, isRefresh = false) => {
      try {
        await fetchConversations(isRefresh);
        setRetryCount(0);
      } catch (error) {
        if (attempt < 3) {
          setTimeout(
            () => fetchWithRetry(attempt + 1, isRefresh),
            1000 * Math.pow(2, attempt)
          );
        }
      }
    },
    [fetchConversations]
  );

  const onRefresh = useCallback(() => {
    fetchConversations(true, false);
  }, [fetchConversations]);

  const loadMoreConversations = useCallback(() => {
    if (pagination.hasMore && !loadingMore && !loading) {
      fetchConversations(false, true);
    }
  }, [pagination.hasMore, loadingMore, loading, fetchConversations]);

  // Real-time updates with WebSocket or polling
  useEffect(() => {
    let isMounted = true;
    
    const interval = setInterval(() => {
      if (!loading && !refreshing && isMounted && !isConnected) {
        fetchConversations(true, false);
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [loading, refreshing, fetchConversations, isConnected]);

  // Initial fetch
  useEffect(() => {
    let isMounted = true;
    
    if (isMounted) {
      fetchConversations();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const formatTime = (dateString: string) => {
    try {
      if (!dateString) return "";
      
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (diffInHours < 168) {
        return date.toLocaleDateString([], { weekday: "short" });
      } else {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      }
    } catch {
      return "";
    }
  };

  const getLastMessagePreview = (conversation: Conversation) => {
    if (!conversation.lastMessage) {
      return "No messages yet";
    }

    const message = conversation.lastMessage.content;
    
    if (!message) {
      switch (conversation.lastMessage.type) {
        case 'image':
          return '📷 Image';
        case 'video':
          return '🎥 Video';
        case 'file':
          return '📎 File';
        default:
          return 'Message';
      }
    }

    if (typeof message !== 'string') {
      return "Message unavailable";
    }

    return message.length > 50 ? message.substring(0, 50) + "..." : message;
  };

  const handleConversationPress = (conversation: Conversation) => {
    if (!conversation.participant) {
      console.error("Cannot navigate: Conversation missing participant");
      return;
    }

    setNewMessageNotification(null);

    router.push({
      pathname: `/chat/${conversation._id}`,
      params: {
        participantId: conversation.participant._id,
        participantName: conversation.participant.name,
      },
    });
  };

  const handleNotificationPress = () => {
    if (newMessageNotification) {
      handleConversationPress({
        _id: newMessageNotification.conversationId,
        participant: { 
          _id: newMessageNotification.message.senderId,
          name: newMessageNotification.message.sender?.name || 'User',
          username: newMessageNotification.message.sender?.username || 'user',
          isOnline: false
        },
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      } as Conversation);
    }
  };

  const renderConversation = ({ item, index }: { item: Conversation; index: number }) => {
    const hasLastMessage = item.lastMessage && item.lastMessage._id;
    const lastMessageTime = hasLastMessage ? formatTime(item.lastMessage!.createdAt) : '';
    const messagePreview = getLastMessagePreview(item);

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => handleConversationPress(item)}
        accessibilityLabel={`Conversation with ${item.participant.name}`}
        accessibilityHint="Opens chat conversation"
        accessibilityRole="button"
      >
        <View style={styles.avatarContainer}>
          {item.participant.profilePicture ? (
            <Image
              source={{ uri: item.participant.profilePicture }}
              style={styles.avatar}
              onError={(e) => {
                console.log("Failed to load avatar for:", item.participant.name);
              }}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {item.participant.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {item.participant.isOnline && (
            <View style={styles.onlineIndicator} />
          )}
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>
                {item.unreadCount > 99 ? "99+" : item.unreadCount}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.participantName} numberOfLines={1}>
              {item.participant.name}
            </Text>
            {hasLastMessage && (
              <Text style={styles.timeText}>
                {lastMessageTime}
              </Text>
            )}
          </View>

          <View style={styles.messagePreview}>
            <Text
              style={[
                styles.lastMessage,
                item.unreadCount > 0 && styles.unreadMessage,
              ]}
              numberOfLines={1}
            >
              {messagePreview}
            </Text>
            {item.unreadCount > 0 && <View style={styles.unreadDot} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // NEW: Render search result item
  const renderSearchResult = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleSelectFriend(item)}
    >
      <View style={styles.avatarContainer}>
        {item.profilePicture ? (
          <Image
            source={{ uri: item.profilePicture }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName}>{item.name}</Text>
        <Text style={styles.searchResultUsername}>@{item.username}</Text>
      </View>
      <Ionicons name="add-circle" size={24} color={colors.primary} />
    </TouchableOpacity>
  );

  // NEW: Render selected friend
  const renderSelectedFriend = (friend: User) => (
    <View key={friend._id} style={styles.selectedFriend}>
      <View style={styles.selectedFriendAvatar}>
        {friend.profilePicture ? (
          <Image
            source={{ uri: friend.profilePicture }}
            style={styles.smallAvatar}
          />
        ) : (
          <View style={[styles.smallAvatar, styles.avatarPlaceholder]}>
            <Text style={styles.smallAvatarText}>
              {friend.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.selectedFriendName} numberOfLines={1}>
        {friend.name}
      </Text>
      <TouchableOpacity
        onPress={() => handleRemoveFriend(friend._id)}
        style={styles.removeFriendButton}
      >
        <Ionicons name="close" size={16} color={colors.text} />
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.footerLoaderText}>
          Loading more conversations...
        </Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.errorTitle}>Unable to load conversations</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchWithRetry(0, false)}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Message Notification Popup */}
      {newMessageNotification?.show && (
        <TouchableOpacity 
          style={styles.popupNotification}
          onPress={handleNotificationPress}
        >
          <View style={styles.notificationContent}>
            <Image 
              source={{ 
                uri: newMessageNotification.message.sender?.profilePicture || 
                'https://via.placeholder.com/40x40/007AFF/FFFFFF?text=U'
              }}
              style={styles.notificationAvatar}
            />
            <View style={styles.notificationText}>
              <Text style={styles.notificationName}>
                {newMessageNotification.message.sender?.name || 'User'}
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

      {/* Header with New Message Button */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Chats</Text>
          <TouchableOpacity 
            style={styles.newMessageButton}
            onPress={openNewMessageModal}
          >
            <Ionicons name="create-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
        
        {conversations.length > 0 && (
          <Text style={styles.conversationCount}>
            {pagination.totalCount} {pagination.totalCount === 1 ? "chat" : "chats"}
          </Text>
        )}
      </View>

      {/* Search Bar */}
      {conversations.length > 0 && (
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={(item, index) => `${item._id}-${index}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={loadMoreConversations}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="chatbubble-outline"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyStateTitle}>
              {searchQuery
                ? "No matching conversations"
                : "No messages yet"}
            </Text>
            <Text style={styles.emptyStateText}>
              {searchQuery
                ? "Try adjusting your search terms"
                : "Tap the compose button to start a new conversation"}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={styles.startChatButton}
                onPress={openNewMessageModal}
              >
                <Text style={styles.startChatText}>Start a Chat</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          filteredConversations.length === 0
            ? styles.emptyListContainer
            : styles.listContainer
        }
      />

      {/* New Message Modal */}
      <Modal
        visible={showNewMessageModal}
        animationType="none"
        transparent={true}
        statusBarTranslucent
      >
        <Animated.View 
          style={[
            styles.modalOverlay,
            { opacity: modalAnimation }
          ]}
        >
          <Animated.View 
            style={[
              styles.modalContent,
              { transform: [{ translateY: slideAnimation }] }
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeNewMessageModal}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New Message</Text>
              <TouchableOpacity 
                onPress={startNewConversation}
                disabled={selectedFriends.length === 0}
                style={[
                  styles.nextButton,
                  selectedFriends.length === 0 && styles.nextButtonDisabled
                ]}
              >
                <Text style={[
                  styles.nextButtonText,
                  selectedFriends.length === 0 && styles.nextButtonTextDisabled
                ]}>
                  Next
                </Text>
              </TouchableOpacity>
            </View>

            {/* Selected Friends */}
            {selectedFriends.length > 0 && (
              <View style={styles.selectedFriendsContainer}>
                <Text style={styles.selectedFriendsLabel}>To:</Text>
                <View style={styles.selectedFriendsList}>
                  {selectedFriends.map(renderSelectedFriend)}
                </View>
              </View>
            )}

            {/* Friend Search */}
            <View style={styles.modalSearchContainer}>
              <Ionicons
                name="search"
                size={20}
                color={colors.textSecondary}
                style={styles.modalSearchIcon}
              />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search friends..."
                placeholderTextColor={colors.textSecondary}
                value={friendSearchQuery}
                onChangeText={(text) => {
                  setFriendSearchQuery(text);
                  searchFriends(text);
                }}
                autoFocus
              />
              {searchingFriends && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
            </View>

            {/* Search Results */}
            {friendSearchQuery.length > 0 && (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item._id}
                style={styles.searchResultsList}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  searchingFriends ? (
                    <View style={styles.searchLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.searchLoadingText}>Searching...</Text>
                    </View>
                  ) : (
                    <View style={styles.noResults}>
                      <Text style={styles.noResultsText}>No friends found</Text>
                    </View>
                  )
                }
              />
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerTitle: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "bold",
    },
    newMessageButton: {
      padding: 8,
    },
    conversationCount: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 4,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchIcon: {
      marginRight: 12,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      paddingVertical: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 12,
      color: colors.textSecondary,
      fontSize: 16,
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    errorTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "bold",
      marginTop: 16,
      marginBottom: 8,
    },
    errorText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 12,
    },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "bold",
    },
    conversationItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatarContainer: {
      position: "relative",
      marginRight: 12,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      color: "#fff",
      fontSize: 20,
      fontWeight: "bold",
    },
    onlineIndicator: {
      position: "absolute",
      bottom: 2,
      right: 2,
      width: 14,
      height: 14,
      backgroundColor: '#4CAF50',
      borderWidth: 2,
      borderColor: colors.background,
      borderRadius: 7,
    },
    unreadBadge: {
      position: "absolute",
      top: -2,
      right: -2,
      backgroundColor: '#FF3B30',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.background,
    },
    unreadCount: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "bold",
    },
    conversationContent: {
      flex: 1,
    },
    conversationHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    participantName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
      flex: 1,
      marginRight: 8,
    },
    timeText: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    messagePreview: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    lastMessage: {
      color: colors.textSecondary,
      fontSize: 14,
      flex: 1,
      marginRight: 8,
    },
    unreadMessage: {
      color: colors.text,
      fontWeight: "600",
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 80,
      paddingHorizontal: 40,
    },
    emptyStateTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "bold",
      marginTop: 16,
      marginBottom: 8,
    },
    emptyStateText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
    startChatButton: {
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: colors.primary,
      borderRadius: 20,
    },
    startChatText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    emptyListContainer: {
      flexGrow: 1,
      justifyContent: "center",
    },
    listContainer: {
      flexGrow: 1,
    },
    footerLoader: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 16,
    },
    footerLoaderText: {
      marginLeft: 8,
      color: colors.textSecondary,
      fontSize: 14,
    },
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
    notificationText: {
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
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: 'bold',
    },
    nextButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    nextButtonDisabled: {
      opacity: 0.5,
    },
    nextButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    nextButtonTextDisabled: {
      color: colors.textSecondary,
    },
    selectedFriendsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    selectedFriendsLabel: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginRight: 12,
    },
    selectedFriendsList: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    selectedFriend: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 16,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginRight: 8,
      marginBottom: 4,
    },
    selectedFriendAvatar: {
      marginRight: 6,
    },
    smallAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    smallAvatarText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: 'bold',
    },
    selectedFriendName: {
      color: colors.text,
      fontSize: 14,
      marginRight: 4,
      maxWidth: 100,
    },
    removeFriendButton: {
      padding: 2,
    },
    modalSearchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalSearchIcon: {
      marginRight: 12,
    },
    modalSearchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      paddingVertical: 8,
    },
    searchResultsList: {
      maxHeight: 300,
    },
    searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchResultInfo: {
      flex: 1,
      marginLeft: 12,
    },
    searchResultName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    searchResultUsername: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    searchLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    searchLoadingText: {
      color: colors.textSecondary,
      fontSize: 14,
      marginLeft: 8,
    },
    noResults: {
      padding: 20,
      alignItems: 'center',
    },
    noResultsText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
  });