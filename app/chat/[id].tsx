import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import io, { Socket } from "socket.io-client";
import { useThemeStyles } from "../../hooks/useThemeStyles";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

interface Message {
  _id: string;
  content: string;
  senderId: string | any;
  type: string;
  createdAt: string;
  status?: 'sent' | 'delivered' | 'read';
  readBy?: string[];
}

interface Participant {
  _id: string;
  name: string;
  username: string;
  profilePicture?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

interface Conversation {
  _id: string;
  participants: string[];
  participant?: Participant;
  unreadCounts?: Array<{ userId: string; count: number }>;
}

interface CallData {
  callId: string;
  callerId: string;
  recipientId: string;
  callType: 'audio' | 'video';
  conversationId: string;
  status: 'ringing' | 'active' | 'ended';
  callerInfo?: Participant;
  recipientInfo?: Participant;
}

export default function ChatScreen() {
  const { theme, toggleTheme, setTheme } = useTheme();
  const { colors, isDark } = useThemeStyles();
  const { user, getAuthHeaders } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const participantId = params.participantId as string;
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  
  // Call states
  const [incomingCall, setIncomingCall] = useState<CallData | null>(null);
  const [activeCall, setActiveCall] = useState<CallData | null>(null);
  const [isCallModalVisible, setIsCallModalVisible] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'connecting' | 'active' | 'ended'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callDurationRef = useRef<NodeJS.Timeout | null>(null);

  const styles = createStyles(colors);

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
        console.log('No Authorization header found. Available headers:', Object.keys(headers));
        return null;
      }

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

  // Initialize WebSocket connection
  const initializeSocket = useCallback(async () => {
    if (!conversation?._id) return;

    try {
      const token = await getToken();
      if (!token) {
        console.log('No token available for WebSocket connection');
        return;
      }

      // Close existing socket connection
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      // Create new socket connection
      socketRef.current = io('http://localhost:3000', {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling']
      });

      socketRef.current.on('connect', () => {
        console.log('WebSocket connected');
      });

      socketRef.current.on('disconnect', () => {
        console.log('WebSocket disconnected');
      });

      socketRef.current.on('new_message', (data) => {
        console.log('Received new message via WebSocket:', data);
        
        if (data.conversationId === conversation._id) {
          setMessages(prev => {
            const messageExists = prev.some(msg => msg._id === data.message._id);
            if (messageExists) return prev;
            
            return [...prev, {
              ...data.message,
              status: 'delivered'
            }];
          });

          const senderId = data.message.senderId?._id || data.message.senderId;
          if (senderId !== user?.id) {
            markMessagesAsRead();
          }
        }
      });

      socketRef.current.on('user_typing', (data) => {
        if (data.conversationId === conversation._id && data.userId !== user?.id) {
          setIsTyping(data.isTyping);
        }
      });

      socketRef.current.on('messages_read', (data) => {
        if (data.conversationId === conversation._id) {
          setMessages(prev => prev.map(msg => {
            const senderId = msg.senderId?._id || msg.senderId;
            if (senderId !== user?.id && !msg.readBy?.includes(data.readBy)) {
              return {
                ...msg,
                readBy: [...(msg.readBy || []), data.readBy],
                status: 'read'
              };
            }
            return msg;
          }));
        }
      });

      socketRef.current.on('user_status_change', (data) => {
        if (data.userId === participantId) {
          setParticipant(prev => prev ? {
            ...prev,
            isOnline: data.isOnline,
            lastSeen: data.lastSeen
          } : null);
        }
      });

      // **CALL HANDLERS**
      socketRef.current.on('incoming_call', (data: CallData) => {
        console.log('Incoming call:', data);
        setIncomingCall(data);
        setIsCallModalVisible(true);
        setCallStatus('ringing');
      });

      socketRef.current.on('call_initiated', (data) => {
        console.log('Call initiated successfully:', data);
        setCallStatus('ringing');
        setActiveCall(prev => prev ? { ...prev, callId: data.callId } : null);
      });

      socketRef.current.on('call_accepted', (data) => {
        console.log('Call accepted by recipient:', data);
        setCallStatus('active');
        setIncomingCall(null);
        startCallTimer();
      });

      socketRef.current.on('call_rejected', (data) => {
        console.log('Call rejected:', data);
        Alert.alert('Call Rejected', data.reason || 'The call was rejected');
        endCall();
      });

      socketRef.current.on('call_ended', (data) => {
        console.log('Call ended:', data);
        Alert.alert('Call Ended', data.reason || 'The call has ended');
        endCall();
      });

      socketRef.current.on('call_failed', (data) => {
        console.log('Call failed:', data);
        Alert.alert('Call Failed', data.message || 'Failed to initiate call');
        endCall();
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
      });

    } catch (error) {
      console.error('Error initializing WebSocket:', error);
    }
  }, [conversation?._id, user?.id, participantId, getToken, activeCall]);

  // Call Management Functions
  const initiateCall = async (callType: 'audio' | 'video') => {
    if (!conversation || !socketRef.current) {
      Alert.alert('Error', 'Cannot make call at this time');
      return;
    }

    try {
      setCallStatus('connecting');
      setActiveCall({
        callId: '',
        callerId: user!.id,
        recipientId: participantId,
        callType: callType,
        conversationId: conversation._id,
        status: 'ringing'
      });
      setIsCallModalVisible(true);

      // Initiate call via socket
      socketRef.current.emit('call_initiate', {
        recipientId: participantId,
        callType: callType,
        conversationId: conversation._id
      });

    } catch (error) {
      console.error('Error initiating call:', error);
      Alert.alert('Error', 'Failed to start call.');
      endCall();
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !socketRef.current) return;

    try {
      setActiveCall(incomingCall);
      setCallStatus('active');
      
      // Accept call via socket
      socketRef.current.emit('call_accept', {
        callId: incomingCall.callId
      });

      setIncomingCall(null);
      startCallTimer();

    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert('Error', 'Failed to accept call.');
      endCall();
    }
  };

  const rejectCall = () => {
    if (!incomingCall || !socketRef.current) return;

    socketRef.current.emit('call_reject', {
      callId: incomingCall.callId,
      reason: 'Declined'
    });

    setIncomingCall(null);
    setIsCallModalVisible(false);
    setCallStatus('idle');
  };

  const endCall = () => {
    if (socketRef.current && activeCall) {
      socketRef.current.emit('call_end', {
        callId: activeCall.callId
      });
    }

    setActiveCall(null);
    setIncomingCall(null);
    setIsCallModalVisible(false);
    setCallStatus('idle');
    stopCallTimer();
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Implement actual mute logic with WebRTC here
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    // Implement actual video toggle logic with WebRTC here
  };

  // Call timer functions
  const startCallTimer = () => {
    callDurationRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (callDurationRef.current) {
      clearInterval(callDurationRef.current);
      callDurationRef.current = null;
    }
    setCallDuration(0);
  };

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle typing indicators
  const handleTypingStart = useCallback(() => {
    if (!socketRef.current || !conversation?._id) return;

    socketRef.current.emit('typing_start', {
      conversationId: conversation._id
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [conversation?._id]);

  const handleTypingStop = useCallback(() => {
    if (!socketRef.current || !conversation?._id) return;

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing_stop', {
        conversationId: conversation._id
      });
    }, 1000);
  }, [conversation?._id]);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async () => {
    if (!conversation?._id || !socketRef.current) return;

    try {
      socketRef.current.emit('mark_messages_read', {
        conversationId: conversation._id
      });

      const authHeaders = await getAuthHeaders();
      await fetch(
        `http://localhost:3000/conversations/${conversation._id}/read`,
        {
          method: 'PUT',
          headers: authHeaders,
        }
      );

      setMessages(prev => prev.map(msg => {
        const senderId = msg.senderId?._id || msg.senderId;
        if (senderId !== user?.id) {
          return {
            ...msg,
            readBy: [...(msg.readBy || []), user?.id || ''],
            status: 'read'
          };
        }
        return msg;
      }));

    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [conversation?._id, user?.id, getAuthHeaders]);

  // Get or create conversation with participant
  const getOrCreateConversation = useCallback(async () => {
    try {
      console.log('Step 1: Getting/Creating conversation with participant:', participantId);
      const authHeaders = await getAuthHeaders();
      
      const response = await fetch(
        `http://localhost:3000/conversations/participant/${participantId}`,
        {
          method: 'GET',
          headers: authHeaders,
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Conversation API response:', data);
        
        if (data.success && data.conversation) {
          let participantData = null;
          
          if (data.conversation.participant) {
            participantData = data.conversation.participant;
          }
          
          console.log('Found participant data:', participantData);
          
          setConversation(data.conversation);
          if (participantData) {
            setParticipant(participantData);
          }
          return data.conversation._id;
        }
      }

      console.log('No conversation found, creating new one...');
      return await createConversation();
    } catch (error) {
      console.error('Error getting conversation:', error);
      return await createConversation();
    }
  }, [participantId, getAuthHeaders, user?.id]);

  // Create new conversation
  const createConversation = useCallback(async () => {
    try {
      console.log('Creating new conversation with participant:', participantId);
      const authHeaders = await getAuthHeaders();
      
      const response = await fetch(
        `http://localhost:3000/conversations`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            participantId: participantId,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Conversation created:', data);
        
        if (data.success && data.conversation) {
          setConversation(data.conversation);
          setParticipant(data.conversation.participant);
          return data.conversation._id;
        }
      }
      throw new Error('Failed to create conversation');
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }, [participantId, getAuthHeaders]);

  // Load participant details if not available from conversation
  const loadParticipantDetails = useCallback(async () => {
    if (participant) {
      console.log('Participant already loaded from conversation:', participant);
      return participant;
    }

    try {
      console.log('Step 2: Loading participant details:', participantId);
      const authHeaders = await getAuthHeaders();
      
      const response = await fetch(
        `http://localhost:3000/users/${participantId}`,
        {
          method: 'GET',
          headers: authHeaders,
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Participant details loaded:', data);
        
        let participantData: Participant | null = null;
        
        if (data.user) {
          participantData = data.user;
        } else if (data.data) {
          participantData = data.data;
        } else if (data.name || data.username) {
          participantData = data;
        } else if (data.success && data.user) {
          participantData = data.user;
        }

        if (participantData) {
          setParticipant(participantData);
          return participantData;
        }
      }
      
      throw new Error('Failed to load participant details');
    } catch (error) {
      console.error('Error loading participant details:', error);
      throw error;
    }
  }, [participantId, participant, getAuthHeaders]);

  // Get online status
  const getOnlineStatus = useCallback(async () => {
    if (!participantId) return;

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `http://localhost:3000/users/online-status/${participantId}`,
        {
          method: 'GET',
          headers: authHeaders,
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setParticipant(prev => prev ? {
            ...prev,
            isOnline: data.isOnline,
            lastSeen: data.lastSeen
          } : null);
        }
      }
    } catch (error) {
      console.error('Error getting online status:', error);
    }
  }, [participantId, getAuthHeaders]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      console.log('Step 3: Fetching messages for conversation:', conversationId);
      const authHeaders = await getAuthHeaders();
      
      const response = await fetch(
        `http://localhost:3000/conversations/${conversationId}/messages`,
        {
          method: 'GET',
          headers: authHeaders,
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.log('No messages found, starting fresh conversation');
          setMessages([]);
          return;
        }
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const data = await response.json();
      console.log('Messages loaded:', data);
      
      if (data.success) {
        const formattedMessages = (data.messages || []).map((msg: any) => {
          const senderId = msg.senderId?._id || msg.senderId;
          const isRead = msg.readBy?.includes(user?.id);
          
          return {
            _id: msg._id || msg.id,
            content: msg.content,
            senderId: senderId,
            type: msg.type || 'text',
            createdAt: msg.createdAt,
            status: isRead ? 'read' : 'delivered',
            readBy: msg.readBy || []
          };
        });
        
        const sortedMessages = formattedMessages.sort((a: Message, b: Message) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        setMessages(sortedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    }
  }, [getAuthHeaders, user?.id]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !conversation) return;

    try {
      setSending(true);
      const authHeaders = await getAuthHeaders();
      
      const tempMessage: Message = {
        _id: `temp-${Date.now()}`,
        content: newMessage.trim(),
        senderId: user!.id,
        type: 'text',
        createdAt: new Date().toISOString(),
        status: 'sent'
      };

      setMessages(prev => [...prev, tempMessage]);
      setNewMessage("");

      handleTypingStop();

      const response = await fetch(
        `http://localhost:3000/messages`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            conversationId: conversation._id,
            content: newMessage.trim(),
            type: 'text',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message');
      }

      const data = await response.json();
      console.log('Message sent successfully:', data);
      
      if (data.success) {
        setMessages(prev => 
          prev.map(msg => 
            msg._id === tempMessage._id 
              ? { 
                  ...data.message, 
                  status: 'delivered',
                  _id: data.message._id,
                  senderId: data.message.senderId?._id || data.message.senderId,
                }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      setMessages(prev => prev.filter(msg => !msg._id.startsWith('temp-')));
    } finally {
      setSending(false);
    }
  };

  // Handle text input changes for typing indicators
  const handleTextChange = (text: string) => {
    setNewMessage(text);
    
    if (text.length > 0) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  };

  // Initial data load
  useEffect(() => {
    if (participantId) {
      const initializeChat = async () => {
        setLoading(true);
        try {
          console.log('=== INITIALIZING CHAT ===');
          
          const conversationId = await getOrCreateConversation();
          
          if (conversationId) {
            await loadParticipantDetails();
            await getOnlineStatus();
            await fetchMessages(conversationId);
            
            console.log('=== CHAT INITIALIZED SUCCESSFULLY ===');
          } else {
            throw new Error('Failed to initialize conversation');
          }
          
        } catch (error) {
          console.error('Error initializing chat:', error);
          
          try {
            await loadParticipantDetails();
          } catch (participantError) {
            console.error('Also failed to load participant:', participantError);
          }
          
          Alert.alert(
            'Error', 
            'Failed to load chat. You can still try to send messages.',
            [{ text: 'OK' }]
          );
        } finally {
          setLoading(false);
        }
      };

      initializeChat();
    }
  }, [participantId]);

  // Initialize WebSocket when conversation is loaded
  useEffect(() => {
    if (conversation?._id) {
      initializeSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (callDurationRef.current) {
        clearInterval(callDurationRef.current);
      }
    };
  }, [conversation?._id, initializeSocket]);

  // Mark messages as read when chat is opened
  useEffect(() => {
    if (messages.length > 0 && conversation?._id) {
      const unreadMessages = messages.filter(msg => {
        const senderId = msg.senderId?._id || msg.senderId;
        return senderId !== user?.id && !msg.readBy?.includes(user?.id || '');
      });
      
      if (unreadMessages.length > 0) {
        markMessagesAsRead();
      }
    }
  }, [messages, conversation?._id, user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Call buttons component
  const renderCallButtons = () => (
    <View style={styles.callButtonsContainer}>
      <TouchableOpacity 
        style={[styles.callButton, styles.audioCallButton]}
        onPress={() => initiateCall('audio')}
        disabled={!participant?.isOnline || callStatus !== 'idle'}
      >
        <Ionicons name="call" size={20} color="#fff" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.callButton, styles.videoCallButton]}
        onPress={() => initiateCall('video')}
        disabled={!participant?.isOnline || callStatus !== 'idle'}
      >
        <Ionicons name="videocam" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  // Call modal component
  const renderCallModal = () => (
    <Modal
      visible={isCallModalVisible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.callContainer}>
        {/* Call Info */}
        <View style={styles.callInfoContainer}>
          <Image 
            source={{ uri: activeCall?.callerInfo?.profilePicture || incomingCall?.callerInfo?.profilePicture || participant?.profilePicture }} 
            style={styles.callAvatar}
            
          />
          <Text style={styles.callUserName}>
            {activeCall?.callerInfo?.name || incomingCall?.callerInfo?.name || participant?.name || 'User'}
          </Text>
          
          {callStatus === 'ringing' && incomingCall && (
            <Text style={styles.callStatus}>Incoming {incomingCall.callType} call...</Text>
          )}
          
          {callStatus === 'ringing' && activeCall && (
            <Text style={styles.callStatus}>Calling...</Text>
          )}
          
          {callStatus === 'connecting' && (
            <Text style={styles.callStatus}>Connecting...</Text>
          )}
          
          {callStatus === 'active' && (
            <Text style={styles.callDuration}>
              {formatCallDuration(callDuration)}
            </Text>
          )}
        </View>

        {/* Call Controls */}
        <View style={styles.callControls}>
          {incomingCall ? (
            // Incoming call controls
            <>
              <TouchableOpacity 
                style={[styles.callControlButton, styles.rejectCallButton]}
                onPress={rejectCall}
              >
                <Ionicons name="call" size={30} color="#fff" />
                <Text style={styles.callControlText}>Decline</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.callControlButton, styles.acceptCallButton]}
                onPress={acceptCall}
              >
                <Ionicons name="call" size={30} color="#fff" />
                <Text style={styles.callControlText}>Accept</Text>
              </TouchableOpacity>
            </>
          ) : (
            // Active call controls
            <>
              <TouchableOpacity 
                style={[styles.callControlButton, isMuted ? styles.callControlButtonActive : styles.muteButton]}
                onPress={toggleMute}
              >
                <Ionicons 
                  name={isMuted ? "mic-off" : "mic"} 
                  size={30} 
                  color="#fff" 
                />
                <Text style={styles.callControlText}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </Text>
              </TouchableOpacity>

              {activeCall?.callType === 'video' && (
                <TouchableOpacity 
                  style={[styles.callControlButton, isVideoOff ? styles.callControlButtonActive : styles.videoButton]}
                  onPress={toggleVideo}
                >
                  <Ionicons 
                    name={isVideoOff ? "videocam-off" : "videocam"} 
                    size={30} 
                    color="#fff" 
                  />
                  <Text style={styles.callControlText}>
                    {isVideoOff ? 'Video On' : 'Video Off'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[styles.callControlButton, styles.endCallButton]}
                onPress={endCall}
              >
                <Ionicons name="call" size={30} color="#fff" />
                <Text style={styles.callControlText}>End</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderMessage = ({ item }: { item: Message }) => {
    let senderId: string;
    
    if (typeof item.senderId === 'string') {
      senderId = item.senderId;
    } else if (item.senderId && typeof item.senderId === 'object' && item.senderId._id) {
      senderId = item.senderId._id;
    } else {
      senderId = item.senderId;
    }
    const isMyMessage = senderId === user?.id;
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer
      ]}>
        {!isMyMessage && participant && (
          <View style={styles.avatarContainer}>
            {participant.profilePicture ? (
              <Image 
                source={{ uri: participant.profilePicture }} 
                style={styles.avatar}
                onError={(e) => console.log('Failed to load avatar:', e.nativeEvent.error)}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {participant.name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessage : styles.theirMessage
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.theirMessageText
          ]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : styles.theirMessageTime
            ]}>
              {new Date(item.createdAt).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
            {isMyMessage && (
              <Ionicons 
                name={item.status === 'read' ? 'checkmark-done' : 'checkmark'} 
                size={16} 
                color={item.status === 'read' ? colors.primary : colors.textSecondary} 
                style={styles.statusIcon}
              />
            )}
          </View>
        </View>

        {!isMyMessage && <View style={styles.avatarSpacer} />}
      </View>
    );
  };

  // Format online status text
  const getStatusText = () => {
    if (participant?.isOnline) {
      return "Online";
    } else if (participant?.lastSeen) {
      return `Last seen ${new Date(participant.lastSeen).toLocaleTimeString()}`;
    } else {
      return "Offline";
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {!participant ? 'Loading user...' : 'Loading messages...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!participant) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.errorTitle}>User Not Found</Text>
          <Text style={styles.errorText}>
            The user you're trying to message doesn't exist or can't be loaded.
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatarContainer}>
            {participant.profilePicture ? (
              <Image 
                source={{ uri: participant.profilePicture }} 
                style={styles.headerAvatar}
                onError={(e) => console.log('Failed to load header avatar:', e.nativeEvent.error)}
              />
            ) : (
              <View style={[styles.headerAvatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {participant.name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            {participant.isOnline && (
              <View style={styles.onlineIndicator} />
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerName}>
              {participant.name || 'User'}
            </Text>
            <Text style={[
              styles.headerStatus,
              { color: participant.isOnline ? colors.primary : colors.textSecondary }
            ]}>
              {getStatusText()}
            </Text>
          </View>
        </View>

        {/* Call buttons in header */}
        {renderCallButtons()}

        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyStateTitle}>No messages yet</Text>
              <Text style={styles.emptyStateText}>
                Start the conversation by sending a message!
              </Text>
            </View>
          }
          ListFooterComponent={
            isTyping ? (
              <View style={styles.typingContainer}>
                <View style={styles.typingBubble}>
                  <Text style={styles.typingText}>
                    {participant?.name || 'User'} is typing...
                  </Text>
                  <View style={styles.typingDots}>
                    <View style={[styles.typingDot, { backgroundColor: colors.primary }]} />
                    <View style={[styles.typingDot, { backgroundColor: colors.primary }]} />
                    <View style={[styles.typingDot, { backgroundColor: colors.primary }]} />
                  </View>
                </View>
              </View>
            ) : null
          }
        />

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachmentButton}>
            <Ionicons name="add" size={24} color={colors.primary} />
          </TouchableOpacity>
          
          <TextInput
            style={styles.textInput}
            value={newMessage}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={1000}
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
            editable={!sending}
          />
          
          <TouchableOpacity 
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending || !conversation) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending || !conversation}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Call Modal */}
      {renderCallModal()}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  headerAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerStatus: {
    fontSize: 12,
  },
  headerButton: {
    padding: 4,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: colors.card,
    borderRadius: 6,
  },
  keyboardAvoid: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    maxWidth: '100%',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarSpacer: {
    width: 40,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageBubble: {
    maxWidth: '70%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  myMessage: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: colors.text,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  messageTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirMessageTime: {
    color: colors.textSecondary,
  },
  statusIcon: {
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  attachmentButton: {
    padding: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    maxHeight: 100,
    color: colors.text,
    backgroundColor: colors.card,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.textSecondary,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  typingBubble: {
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '70%',
  },
  typingText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  typingDots: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
  },
  // Call Button Styles
  callButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  audioCallButton: {
    backgroundColor: '#4CAF50',
  },
  videoCallButton: {
    backgroundColor: '#2196F3',
  },
  // Call Modal Styles
  callContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  callInfoContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  callAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  callUserName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  callStatus: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.8,
  },
  callDuration: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  callControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  callControlButton: {
    alignItems: 'center',
    marginHorizontal: 15,
    padding: 15,
    borderRadius: 35,
  },
  callControlButtonActive: {
    opacity: 0.7,
  },
  callControlText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 12,
  },
  muteButton: {
    backgroundColor: '#666',
  },
  videoButton: {
    backgroundColor: '#666',
  },
  acceptCallButton: {
    backgroundColor: '#4CAF50',
  },
  rejectCallButton: {
    backgroundColor: '#F44336',
  },
  endCallButton: {
    backgroundColor: '#F44336',
  },
});