import {
  Carattere_400Regular,
  useFonts,
} from '@expo-google-fonts/carattere';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useThemeStyles } from '../../hooks/useThemeStyles';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function MenuScreen() {
  const { user, logout } = useAuth(); 
  const router = useRouter();
  const { theme, toggleTheme, setTheme } = useTheme();
  const { colors, isDark } = useThemeStyles();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);

  // Load Carattere font
  let [fontsLoaded] = useFonts({
    Carattere_400Regular,
  });

  const handleLogout = async () => {
    console.log('🔄 handleLogout function called');
    
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        try {
          console.log('✅ Logout confirmed, calling logout()...');
          await logout();
        } catch (error) {
          console.error('Logout error:', error);
          window.alert('Failed to logout. Please try again.');
        }
      } else {
        console.log('❌ Logout cancelled');
      }
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          {
            text: 'Cancel',
            onPress: () => console.log('Cancel Pressed'),
            style: 'cancel',
          },
          { 
            text: 'Logout', 
            onPress: async () => {
              try {
                console.log('✅ Logout confirmed, calling logout()...');
                await logout();
              } catch (error) {
                console.error('Logout error:', error);
                Alert.alert('Error', 'Failed to logout. Please try again.');
              }
            } 
          },
        ],
        { cancelable: false }
      );
    }
  };

  // Calculate user stats (you can replace these with actual data from your backend)
  const userStats = {
    posts: 245, // This should come from your backend
    followers: 1200, // This should come from your backend
    following: 456, // This should come from your backend
  };

  // Fallback profile picture if user doesn't have one
  const profilePicture = user?.profilePicture || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';

  const fullname = user?.fullName;

  const username = user?.username || `@${user?.fullName?.toLowerCase().replace(/\s+/g, '_')}` || '@user';

  const menuSections = [
    {
      title: 'Account',
      items: [
        {
          icon: 'lock-closed-outline',
          title: 'Privacy & Security',
          onPress: () => console.log('Privacy & Security'),
        },
        {
          icon: 'people-outline',
          title: 'Followers & Following',
          onPress: () => console.log('Followers'),
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: 'notifications-outline',
          title: 'Push Notifications',
          type: 'switch',
          value: notificationsEnabled,
          onValueChange: setNotificationsEnabled,
        },
        {
          icon: 'moon-outline',
          title: 'Dark Mode',
          type: 'switch',
          value: isDark,
          onValueChange: (value: boolean) => {
            setTheme(value ? 'dark' : 'light');
          },
        },
        {
          icon: 'language-outline',
          title: 'Language',
          subtitle: 'English',
          onPress: () => console.log('Language'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-circle-outline',
          title: 'Help & Support',
          onPress: () => console.log('Help'),
        },
        {
          icon: 'document-text-outline',
          title: 'Terms of Service',
          onPress: () => console.log('Terms'),
        },
        {
          icon: 'shield-checkmark-outline',
          title: 'Privacy Policy',
          onPress: () => console.log('Privacy Policy'),
        },
        {
          icon: 'information-circle-outline',
          title: 'About',
          onPress: () => console.log('About'),
        },
      ],
    },
  ];

  const styles = createStyles(colors);

  const renderMenuItem = (item: any, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.menuItem}
      onPress={item.onPress}
      disabled={item.type === 'switch'}
    >
      <View style={styles.menuItemLeft}>
        <Ionicons 
          name={item.icon as any} 
          size={22} 
          color={item.color || colors.text} 
          style={styles.menuIcon}
        />
        <View style={styles.menuTextContainer}>
          <Text style={[styles.menuItemTitle, item.color && { color: item.color }]}>
            {item.title}
          </Text>
          {item.subtitle && (
            <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
          )}
        </View>
      </View>

      {item.type === 'switch' ? (
        <Switch
          value={item.value}
          onValueChange={item.onValueChange}
          trackColor={{ false: '#767577', true: colors.accent }}
          thumbColor={item.value ? '#fff' : '#f4f3f4'}
          ios_backgroundColor="#3e3e3e"
        />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );

  // Show loading while fonts are loading
  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* App Header */}
      <View style={styles.appHeader}>
        <Text style={styles.headerTitle}>SmartConnect</Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <Pressable
          style={styles.profileSection}
          onPress={() => router.push('/profile')}
        >
          <View style={styles.profileContainer}>
            <View style={styles.profileImageContainer}>
              <Image 
                source={{ uri: profilePicture }}
                style={styles.profileImage}
                defaultSource={{ uri: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face' }}
              />
              <View style={styles.profileImageBadge}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </View>
            
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {fullname || 'User name'}
              </Text>
              <Text style={styles.profileHandle}>
                {username}
              </Text>
              
              {/* User Bio */}
              {user?.bio ? (
                <Text style={styles.profileBio}>
                  {user.bio}
                </Text>
              ) : (
                <Text style={styles.profileBioPlaceholder}>
                  No bio yet. Tap to add a bio.
                </Text>
              )}
              
            </View>
          </View>
        </Pressable>

        {/* Menu Sections */}
        <View style={styles.menuSections}>
          {menuSections.map((section, sectionIndex) => (
            <View key={sectionIndex} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionContent}>
                {section.items.map(renderMenuItem)}
              </View>
            </View>
          ))}
        </View>

        {/* Logout Section */}
        <View style={styles.logoutSection}>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={22} color="#ff3b30" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>
            SmartConnect v1.0.0 • {theme} mode
            {user?.email && ` • ${user.email}`}
          </Text>
        </View>
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
  appHeader: {
    paddingTop:15,
    paddingBottom: 15,
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
    color:colors.primary,
    fontFamily: "Carattere_400Regular",
    includeFontPadding: false,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.text,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: colors.surface,
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  profileImageBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.accent,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileHandle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  profileBio: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 12,
  },
  profileBioPlaceholder: {
    color: colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  profileStat: {
    alignItems: 'center',
    flex: 1,
  },
  profileStatNumber: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  profileStatLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 16,
    alignSelf: 'center',
  },
  editProfileText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  menuSections: {
    padding: 16,
    paddingTop: 0,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    marginRight: 12,
    width: 24,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  menuItemSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  logoutSection: {
    padding: 16,
    paddingTop: 0,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  logoutText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  versionText: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
});