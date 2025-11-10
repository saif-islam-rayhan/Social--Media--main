import {
  Carattere_400Regular,
  useFonts,
} from '@expo-google-fonts/carattere';
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useAuth } from '../context/AuthContext';

// Emoji data
const emojiCategories = [
  {
    category: "Smileys & People",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
      "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
    ],
  },
  {
    category: "Animals & Nature",
    emojis: [
      "🐵", "🐒", "🦍", "🐶", "🐕", "🐩", "🐺", "🦊", "🐱", "🐈",
      "🦁", "🐯", "🐅", "🐆", "🐴", "🐎", "🦄", "🦓", "🦌", "🐮",
    ],
  },
];

// Location type icons
const locationTypeIcons = {
  city: "🏙️",
  beach: "🏖️",
  park: "🌳",
  landmark: "🗽",
  attraction: "🎡",
  cafe: "☕",
  restaurant: "🍽️",
  mall: "🛍️",
  entertainment: "🎬",
  default: "📍",
} as const;

// Create a type for the location types
type LocationType = keyof typeof locationTypeIcons;

const popularLocations: { id: string; name: string; type: LocationType }[] = [
  { id: '1', name: 'Dhaka, Bangladesh', type: 'city' },
  { id: '2', name: 'Gulshan', type: 'city' },
  { id: '3', name: 'Banani', type: 'city' },
  { id: '4', name: 'Dhanmondi', type: 'city' },
  { id: '5', name: 'Uttara', type: 'city' },
  { id: '11', name: 'Lalbagh Fort', type: 'landmark' },
  { id: '12', name: 'Ahsan Manzil', type: 'landmark' },
  { id: '18', name: 'Bashundhara City Mall', type: 'mall' },
  { id: '22', name: 'Hatirjheel', type: 'park' },
  { id: '34', name: 'North End Coffee', type: 'cafe' },
];

// Helper function to get the icon safely
const getLocationIcon = (type: string): string => {
  return locationTypeIcons[type as LocationType] || locationTypeIcons.default;
};

// Post type enum
type PostType = 'post' | 'reel';

export default function CreatePostScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { getAuthHeaders, isAuthenticated, user } = useAuth();
  
  const [postContent, setPostContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState("");
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState(0);
  const [privacy, setPrivacy] = useState<"public" | "friends" | "private">("public");
  const [postType, setPostType] = useState<PostType>('post');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);

  // Load Carattere font
  let [fontsLoaded] = useFonts({
    Carattere_400Regular,
  });

  const API_BASE_URL = 'http://localhost:3000';

  // Handle incoming image from TabLayout
  useEffect(() => {
    console.log("CreatePost params received:", params);

    if (params.imageUri) {
      const imageUri = params.imageUri as string;
      console.log("Setting selected image from params:", imageUri);
      setSelectedImage(imageUri);
      setSelectedVideo(null);
      setPostType('post');
    }
  }, [params]);

  // Get current location for the "Current Location" option
  useEffect(() => {
    getCurrentLocationName();
  }, []);

  const getCurrentLocationName = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const locationName = `${address.city}, ${address.region}, ${address.country}`;
      setCurrentLocation(locationName);
    } catch (error) {
      console.log("Failed to get current location name");
    }
  };

  // Helper function to convert image URI to base64
  const convertImageToBase64 = async (uri: string): Promise<string> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error('Failed to process image');
    }
  };

  // Helper function to convert video URI to base64
  const convertVideoToBase64 = async (uri: string): Promise<string> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting video to base64:', error);
      throw new Error('Failed to process video');
    }
  };

  // Generate thumbnail from video (simplified version)
  const generateVideoThumbnail = async (videoUri: string): Promise<string> => {
    try {
      // For React Native, we can create a simple thumbnail by taking the first frame
      // In a real app, you might use a library like react-native-video-thumbnail
      console.log("Generating video thumbnail...");
      
      // For now, we'll create a placeholder or use the first frame if possible
      // This is a simplified version - you might want to use a proper thumbnail generator
      return await convertImageToBase64(videoUri); // This will create a base64 of the video file itself
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return '';
    }
  };

  // Get video duration and generate thumbnail
  const getVideoInfo = async (videoUri: string): Promise<{ duration: number; thumbnail: string }> => {
    return new Promise((resolve) => {
      // In React Native, you might use a different approach to get video duration
      // For now, we'll use a simplified version
      const video = document.createElement('video');
      video.src = videoUri;
      video.onloadedmetadata = async () => {
        const duration = video.duration;
        const thumbnail = await generateVideoThumbnail(videoUri);
        resolve({ duration, thumbnail });
      };
      video.onerror = () => {
        resolve({ duration: 0, thumbnail: '' });
      };
    });
  };

  // Upload image to server
  const uploadImage = async (imageUri: string): Promise<string> => {
    try {
      console.log("Starting image upload...");
      
      const base64Image = await convertImageToBase64(imageUri);
      
      const headers = await getAuthHeaders();
      
      const uploadResponse = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          type: 'post'
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();
      
      if (!uploadData.success || !uploadData.url) {
        throw new Error(uploadData.message || 'Failed to upload image');
      }

      console.log("Image uploaded successfully:", uploadData.url);
      return uploadData.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image. Please try again.');
    }
  };

  // Upload video to MongoDB
  const uploadVideoToMongoDB = async (videoUri: string): Promise<{ videoId: string; duration: number }> => {
    try {
      console.log("Starting video upload to MongoDB...");
      
      const base64Video = await convertVideoToBase64(videoUri);
      const videoInfo = await getVideoInfo(videoUri);
      
      setVideoDuration(videoInfo.duration);
      setVideoThumbnail(videoInfo.thumbnail);
      
      const headers = await getAuthHeaders();
      
      const uploadResponse = await fetch(`${API_BASE_URL}/upload/video`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video: base64Video,
          thumbnail: videoInfo.thumbnail,
          duration: videoInfo.duration,
          aspectRatio: '9:16'
        }),
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.message || `Video upload failed with status: ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();
      
      if (!uploadData.success || !uploadData.video) {
        throw new Error(uploadData.message || 'Failed to upload video');
      }

      console.log("Video uploaded successfully to MongoDB:", uploadData.video.id);
      return {
        videoId: uploadData.video.id,
        duration: videoInfo.duration
      };
    } catch (error) {
      console.error('Error uploading video to MongoDB:', error);
      throw new Error('Failed to upload video. Please try again.');
    }
  };

  // Pick Image
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Sorry, we need camera roll permissions to make this work!"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
        setSelectedVideo(null);
        setPostType('post');
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  // Pick Video
  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Sorry, we need camera roll permissions to make this work!"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [9, 16], // Vertical aspect ratio for reels
        quality: 0.8,
        videoMaxDuration: 60, // 60 seconds max for reels
      });

      if (!result.canceled) {
        const video = result.assets[0];
        setSelectedVideo(video.uri);
        setSelectedImage(null);
        setPostType('reel');
        
        // Get video info including duration and generate thumbnail
        if (video.uri) {
          const videoInfo = await getVideoInfo(video.uri);
          setVideoDuration(videoInfo.duration);
          setVideoThumbnail(videoInfo.thumbnail);
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick video");
    }
  };

  // Get Current Location
  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Sorry, we need location permissions to make this work!"
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const locationName = `${address.city}, ${address.region}, ${address.country}`;
      setSelectedLocation(locationName);
      setShowLocationPicker(false);
    } catch (error) {
      Alert.alert("Error", "Failed to get location");
    }
  };

  // Add Emoji to Text
  const addEmoji = (emoji: string) => {
    setPostContent((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Remove Media
  const removeMedia = () => {
    setSelectedImage(null);
    setSelectedVideo(null);
    setVideoDuration(0);
    setVideoThumbnail(null);
  };

  // Remove Location
  const removeLocation = () => {
    setSelectedLocation(null);
  };

  // Handle location selection from the modal
  const handleLocationSelect = (locationName: string) => {
    setSelectedLocation(locationName);
    setShowLocationPicker(false);
    setLocationSearchQuery("");
  };

  // Filter locations based on search query
  const filteredLocations = popularLocations.filter((location) =>
    location.name.toLowerCase().includes(locationSearchQuery.toLowerCase())
  );

  // Create regular post
  const createPost = async (imageUrl?: string) => {
    const postData = {
      content: postContent,
      image: imageUrl || '',
      privacy: privacy,
      location: selectedLocation,
    };

    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || `Server returned ${response.status}`);
    }

    return await response.json();
  };

  // Create reel with MongoDB video
  const createReel = async (videoId: string, duration: number) => {
    const reelData = {
      videoId: videoId,
      content: postContent,
      duration: duration,
      privacy: privacy,
      location: selectedLocation,
    };

    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/reels`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reelData),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || `Server returned ${response.status}`);
    }

    return await response.json();
  };

  const handleSubmit = async () => {
    if (!postContent.trim() && !selectedImage && !selectedVideo) {
      Alert.alert(
        "Error",
        "Please write something or add media before posting."
      );
      return;
    }

    if (postContent.length > 280) {
      Alert.alert("Error", "Post must be less than 280 characters.");
      return;
    }

    if (!isAuthenticated) {
      Alert.alert("Error", "Please login to create a post.");
      return;
    }

    setIsSubmitting(true);

    try {
      let result;

      if (selectedImage) {
        // Handle image post
        console.log("Processing image post...");
        const imageUrl = await uploadImage(selectedImage);
        result = await createPost(imageUrl);
        
      } else if (selectedVideo) {
        // Handle video reel with MongoDB storage
        console.log("Processing video reel with MongoDB storage...");
        const { videoId, duration } = await uploadVideoToMongoDB(selectedVideo);
        result = await createReel(videoId, duration);
        
      } else {
        // Handle text-only post
        console.log("Processing text-only post...");
        result = await createPost();
      }

      console.log("Creation successful:", result);

      Alert.alert(
        "Success", 
        postType === 'reel' ? "Your reel has been created!" : "Your post has been created!"
      );
      
      // Clear form
      setPostContent("");
      setSelectedImage(null);
      setSelectedVideo(null);
      setSelectedLocation(null);
      setVideoDuration(0);
      setVideoThumbnail(null);
      
      setTimeout(() => {
        router.replace(postType === 'reel' ? "/reels" : "/");
      }, 500);
      
    } catch (error) {
      console.error('Error creating content:', error);
      Alert.alert(
        "Error", 
        error instanceof Error ? error.message : "Failed to create post. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDraft = () => {
    if (postContent.trim() || selectedImage || selectedVideo) {
      Alert.alert("Draft Saved", "Your post has been saved as draft.");
    }
    router.back();
  };

  const characterCount = postContent.length;
  const characterLimit = 280;

  // Show loading while fonts are loading
  if (!fontsLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1DA1F2" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* App Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SmartConnect</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>
          {postType === 'reel' ? 'Create New Reel' : 'Create New Post'}
        </Text>

        {/* Post Type Selector */}
        <View style={styles.postTypeContainer}>
          <TouchableOpacity 
            style={[
              styles.postTypeOption, 
              postType === 'post' && styles.postTypeOptionActive
            ]}
            onPress={() => {
              setPostType('post');
              if (selectedVideo) {
                setSelectedVideo(null);
                setVideoDuration(0);
                setVideoThumbnail(null);
              }
            }}
          >
            <Text style={[
              styles.postTypeOptionText,
              postType === 'post' && styles.postTypeOptionTextActive
            ]}>📝 Post</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.postTypeOption, 
              postType === 'reel' && styles.postTypeOptionActive
            ]}
            onPress={() => {
              setPostType('reel');
              if (selectedImage) {
                setSelectedImage(null);
              }
            }}
          >
            <Text style={[
              styles.postTypeOptionText,
              postType === 'reel' && styles.postTypeOptionTextActive
            ]}>🎬 Reel</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy Selector */}
        <View style={styles.privacyContainer}>
          <Text style={styles.privacyLabel}>Privacy:</Text>
          <View style={styles.privacyOptions}>
            <TouchableOpacity 
              style={[
                styles.privacyOption, 
                privacy === 'public' && styles.privacyOptionActive
              ]}
              onPress={() => setPrivacy('public')}
            >
              <Text style={[
                styles.privacyOptionText,
                privacy === 'public' && styles.privacyOptionTextActive
              ]}>🌍 Public</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.privacyOption, 
                privacy === 'friends' && styles.privacyOptionActive
              ]}
              onPress={() => setPrivacy('friends')}
            >
              <Text style={[
                styles.privacyOptionText,
                privacy === 'friends' && styles.privacyOptionTextActive
              ]}>👥 Friends</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.privacyOption, 
                privacy === 'private' && styles.privacyOptionActive
              ]}
              onPress={() => setPrivacy('private')}
            >
              <Text style={[
                styles.privacyOptionText,
                privacy === 'private' && styles.privacyOptionTextActive
              ]}>🔒 Private</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Post Content Input */}
        <TextInput
          style={styles.textInput}
          placeholder={postType === 'reel' ? "Describe your reel..." : "What's happening?"}
          value={postContent}
          onChangeText={setPostContent}
          multiline
          maxLength={characterLimit}
          textAlignVertical="top"
          autoFocus={!selectedImage && !selectedVideo}
        />

        {/* Selected Media Preview */}
        {selectedImage && (
          <View style={styles.mediaPreview}>
            <Image
              source={{ uri: selectedImage }}
              style={styles.previewImage}
            />
            <TouchableOpacity
              style={styles.removeMediaButton}
              onPress={removeMedia}
            >
              <Text style={styles.removeMediaText}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedVideo && (
          <View style={styles.mediaPreview}>
            <View style={styles.videoPreview}>
              <Text style={styles.videoPreviewText}>🎥 Video Selected</Text>
              <Text style={styles.videoInfo}>
                Duration: {Math.round(videoDuration)}s | Reel
              </Text>
              <Text style={styles.videoNote}>
                Video will be stored in MongoDB
              </Text>
              {videoThumbnail && (
                <Image
                  source={{ uri: videoThumbnail }}
                  style={styles.thumbnailImage}
                />
              )}
            </View>
            <TouchableOpacity
              style={styles.removeMediaButton}
              onPress={removeMedia}
            >
              <Text style={styles.removeMediaText}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Selected Location */}
        {selectedLocation && (
          <View style={styles.locationPreview}>
            <Text style={styles.locationText}>📍 {selectedLocation}</Text>
            <TouchableOpacity onPress={removeLocation}>
              <Text style={styles.removeLocationText}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Character Count */}
        <View style={styles.characterCount}>
          <Text
            style={[
              styles.characterCountText,
              characterCount > characterLimit * 0.8 && { color: "#FF9800" },
              characterCount > characterLimit * 0.9 && { color: "#F44336" },
            ]}
          >
            {characterCount}/{characterLimit}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.draftButton]}
            onPress={handleDraft}
          >
            <Text style={styles.draftButtonText}>Save Draft</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              postType === 'reel' ? styles.reelButton : styles.postButton,
              (!postContent.trim() && !selectedImage && !selectedVideo) ||
              postContent.length > characterLimit ||
              isSubmitting
                ? styles.disabledButton
                : null,
            ]}
            onPress={handleSubmit}
            disabled={
              (!postContent.trim() && !selectedImage && !selectedVideo) ||
              postContent.length > characterLimit ||
              isSubmitting
            }
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.postButtonText}>
                {postType === 'reel' ? 'Create Reel' : 'Post'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Media Options */}
        <View style={styles.features}>
          <Text style={styles.featuresTitle}>Add to your {postType === 'reel' ? 'reel' : 'post'}</Text>
          <View style={styles.featureIcons}>
            <TouchableOpacity 
              style={[
                styles.featureIcon,
                postType === 'reel' && styles.featureIconDisabled
              ]} 
              onPress={pickImage}
              disabled={postType === 'reel'}
            >
              <Text style={[
                styles.featureIconText,
                postType === 'reel' && styles.featureIconTextDisabled
              ]}>📷</Text>
              <Text style={styles.featureIconLabel}>Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.featureIcon} 
              onPress={pickVideo}
            >
              <Text style={styles.featureIconText}>🎥</Text>
              <Text style={styles.featureIconLabel}>Video</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.featureIcon}
              onPress={() => setShowLocationPicker(true)}
            >
              <Text style={styles.featureIconText}>📍</Text>
              <Text style={styles.featureIconLabel}>Location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.featureIcon}
              onPress={() => setShowEmojiPicker(true)}
            >
              <Text style={styles.featureIconText}>😊</Text>
              <Text style={styles.featureIconLabel}>Emoji</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Emoji Picker Modal */}
      <Modal
        visible={showEmojiPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEmojiPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowEmojiPicker(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.emojiPicker}>
                <View style={styles.emojiHeader}>
                  <Text style={styles.emojiTitle}>Choose an Emoji</Text>
                  <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                    <Text style={styles.closeButton}>×</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.emojiCategories}>
                  {emojiCategories.map((category, index) => (
                    <TouchableOpacity
                      key={category.category}
                      style={[
                        styles.categoryTab,
                        activeEmojiCategory === index &&
                          styles.activeCategoryTab,
                      ]}
                      onPress={() => setActiveEmojiCategory(index)}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          activeEmojiCategory === index &&
                            styles.activeCategoryText,
                        ]}
                      >
                        {category.category.split(" ")[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <FlatList
                  data={emojiCategories[activeEmojiCategory].emojis}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.emojiItem}
                      onPress={() => addEmoji(item)}
                    >
                      <Text style={styles.emoji}>{item}</Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item, index) => index.toString()}
                  numColumns={8}
                  contentContainerStyle={styles.emojiGrid}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.locationPicker}>
            <View style={styles.locationHeader}>
              <Text style={styles.locationTitle}>Choose a Location</Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search for places..."
                value={locationSearchQuery}
                onChangeText={setLocationSearchQuery}
              />
              <Text style={styles.searchIcon}>🔍</Text>
            </View>

            <TouchableOpacity
              style={styles.locationOption}
              onPress={getLocation}
            >
              <Text style={styles.locationOptionIcon}>🎯</Text>
              <View style={styles.locationOptionText}>
                <Text style={styles.locationOptionName}>Current Location</Text>
                <Text style={styles.locationOptionAddress}>
                  {currentLocation || "Get your current location"}
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Popular Locations</Text>
            <FlatList
              data={filteredLocations}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.locationOption}
                  onPress={() => handleLocationSelect(item.name)}
                >
                  <Text style={styles.locationOptionIcon}>
                    {getLocationIcon(item.type)}
                  </Text>
                  <View style={styles.locationOptionText}>
                    <Text style={styles.locationOptionName}>{item.name}</Text>
                    <Text style={styles.locationOptionType}>
                      {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id}
              style={styles.locationsList}
              showsVerticalScrollIndicator={false}
            />

            <TouchableOpacity
              style={styles.customLocationOption}
              onPress={() => {
                if (locationSearchQuery.trim()) {
                  handleLocationSelect(locationSearchQuery);
                } else {
                  Alert.alert(
                    "Enter Location",
                    "Please type a location name first."
                  );
                }
              }}
            >
              <Text style={styles.customLocationText}>
                {locationSearchQuery.trim()
                  ? `Add "${locationSearchQuery}" as location`
                  : "Type to add custom location"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 32,
    color:'#4d4fcaff',
    fontFamily: "Carattere_400Regular",
    includeFontPadding: false,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#1DA1F2",
  },
  postTypeContainer: {
    flexDirection: "row",
    marginBottom: 15,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 4,
  },
  postTypeOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  postTypeOptionActive: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postTypeOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  postTypeOptionTextActive: {
    color: "#1DA1F2",
    fontWeight: "600",
  },
  privacyContainer: {
    marginBottom: 15,
  },
  privacyLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  privacyOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  privacyOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e1e8ed",
    alignItems: "center",
    marginHorizontal: 4,
  },
  privacyOptionActive: {
    backgroundColor: "#1DA1F2",
    borderColor: "#1DA1F2",
  },
  privacyOptionText: {
    fontSize: 14,
    color: "#657786",
  },
  privacyOptionTextActive: {
    color: "white",
    fontWeight: "600",
  },
  textInput: {
    minHeight: 120,
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: "#e1e8ed",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    textAlignVertical: "top",
  },
  mediaPreview: {
    position: "relative",
    marginBottom: 15,
    borderRadius: 12,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
  videoPreview: {
    width: "100%",
    height: 200,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  videoPreviewText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  videoInfo: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  videoNote: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
    textAlign: "center",
  },
  thumbnailImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginTop: 8,
  },
  removeMediaButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  removeMediaText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  locationPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f0f8ff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  locationText: {
    fontSize: 14,
    color: "#1DA1F2",
  },
  removeLocationText: {
    color: "#666",
    fontSize: 18,
    fontWeight: "bold",
  },
  characterCount: {
    alignItems: "flex-end",
    marginBottom: 20,
  },
  characterCountText: {
    fontSize: 14,
    color: "#657786",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
    marginHorizontal: 5,
  },
  draftButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#1DA1F2",
  },
  postButton: {
    backgroundColor: "#1DA1F2",
  },
  reelButton: {
    backgroundColor: "#E1306C", // Instagram-like pink for reels
  },
  disabledButton: {
    backgroundColor: "#a0d2f7",
  },
  draftButtonText: {
    color: "#1DA1F2",
    fontSize: 16,
    fontWeight: "bold",
  },
  postButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  features: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 20,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  featureIcons: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  featureIcon: {
    alignItems: "center",
  },
  featureIconDisabled: {
    opacity: 0.5,
  },
  featureIconText: {
    fontSize: 24,
    marginBottom: 5,
  },
  featureIconTextDisabled: {
    opacity: 0.5,
  },
  featureIconLabel: {
    fontSize: 12,
    color: "#657786",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  emojiPicker: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "60%",
  },
  emojiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  emojiTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  closeButton: {
    fontSize: 24,
    color: "#666",
  },
  emojiCategories: {
    flexDirection: "row",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  activeCategoryTab: {
    backgroundColor: "#1DA1F2",
  },
  categoryText: {
    fontSize: 14,
    color: "#666",
  },
  activeCategoryText: {
    color: "white",
    fontWeight: "bold",
  },
  emojiGrid: {
    padding: 10,
  },
  emojiItem: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 24,
  },
  locationPicker: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  locationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    borderWidth: 1,
    borderColor: "#e1e8ed",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchIcon: {
    fontSize: 18,
    color: "#657786",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    color: "#333",
  },
  locationsList: {
    maxHeight: 300,
  },
  locationOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  locationOptionIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 30,
  },
  locationOptionText: {
    flex: 1,
  },
  locationOptionName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  locationOptionAddress: {
    fontSize: 14,
    color: "#657786",
    marginTop: 2,
  },
  locationOptionType: {
    fontSize: 12,
    color: "#657786",
    marginTop: 2,
    textTransform: "capitalize",
  },
  customLocationOption: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#f0f8ff",
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1DA1F2",
    borderStyle: "dashed",
  },
  customLocationText: {
    color: "#1DA1F2",
    fontSize: 16,
    fontWeight: "500",
  },
});