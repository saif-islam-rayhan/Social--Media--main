// app/signup.tsx
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function SignupScreen() {
  const [formData, setFormData] = useState({
    fullName: '',
    username: '', // Add username field
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { signup } = useAuth();

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.fullName || !formData.username || !formData.email || !formData.password) {
      return 'Please fill in all fields';
    }

    if (!formData.email.includes('@')) {
      return 'Please enter a valid email address';
    }

    if (formData.password.length < 6) {
      return 'Password must be at least 6 characters long';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }

    if (formData.fullName.length < 2) {
      return 'Name must be at least 2 characters long';
    }

    if (formData.username.length < 3) {
      return 'Username must be at least 3 characters long';
    }

    // Basic username validation (alphanumeric, underscores, hyphens)
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(formData.username)) {
      return 'Username can only contain letters, numbers, underscores, and hyphens';
    }

    return null;
  };

  const handleSignup = async () => {
    const error = validateForm();
    if (error) {
      Alert.alert('Error', error);
      return;
    }

    setIsLoading(true);

    try {
      await signup({
        fullName: formData.fullName,
        username: formData.username, 
        email: formData.email,
        password: formData.password,
      });
      // Navigation handled by AuthContext
    } catch (error) {
      Alert.alert('Signup Failed', error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSignup = (userType: string) => {
    const testUsers = {
      basic: { 
        name: 'Test User', 
        username: `testuser${Date.now()}`,
        email: `test${Date.now()}@example.com`, 
        password: 'password123' 
      },
      developer: { 
        name: 'Developer', 
        username: `dev${Date.now()}`,
        email: `dev${Date.now()}@example.com`, 
        password: 'password123' 
      },
      designer: { 
        name: 'Designer', 
        username: `designer${Date.now()}`,
        email: `design${Date.now()}@example.com`, 
        password: 'password123' 
      },
    };

    const user = testUsers[userType as keyof typeof testUsers];
    if (user) {
      setFormData({
        fullName: user.name,
        username: user.username,
        email: user.email,
        password: user.password,
        confirmPassword: user.password,
      });
      
      // Auto-submit after a short delay
      setTimeout(() => {
        handleSignup();
      }, 500);
    }
  };

  const showQuickSignupOptions = () => {
    Alert.alert(
      'Quick Signup',
      'Choose a test account type:',
      [
        {
          text: 'Basic User',
          onPress: () => handleQuickSignup('basic')
        },
        {
          text: 'Developer',
          onPress: () => handleQuickSignup('developer')
        },
        {
          text: 'Designer', 
          onPress: () => handleQuickSignup('designer')
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>SocialApp</Text>
          <Text style={styles.subtitle}>Join our community today</Text>
        </View>

        {/* Signup Form */}
        <View style={styles.form}>
          <Text style={styles.title}>Sign Up</Text>

          {/* Full Name Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#999"
              value={formData.fullName}
              onChangeText={(value) => handleChange('fullName', value)}
              autoComplete="name"
              editable={!isLoading}
            />
          </View>

          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="at-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#999"
              value={formData.username}
              onChangeText={(value) => handleChange('username', value)}
              autoCapitalize="none"
              autoComplete="username"
              editable={!isLoading}
            />
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#999"
              value={formData.email}
              onChangeText={(value) => handleChange('email', value)}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!isLoading}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={formData.password}
              onChangeText={(value) => handleChange('password', value)}
              secureTextEntry={!showPassword}
              autoComplete="password-new"
              editable={!isLoading}
            />
            <TouchableOpacity 
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#999"
              value={formData.confirmPassword}
              onChangeText={(value) => handleChange('confirmPassword', value)}
              secureTextEntry={!showConfirmPassword}
              autoComplete="password-new"
              editable={!isLoading}
            />
            <TouchableOpacity 
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isLoading}
            >
              <Ionicons 
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[
              styles.signupButton, 
              (!formData.fullName || !formData.username || !formData.email || !formData.password || !formData.confirmPassword || isLoading) && styles.signupButtonDisabled
            ]}
            onPress={handleSignup}
            disabled={!formData.fullName || !formData.username || !formData.email || !formData.password || !formData.confirmPassword || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signupButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Quick Signup Button */}
          <TouchableOpacity 
            style={styles.quickSignupButton}
            onPress={showQuickSignupOptions}
            disabled={isLoading}
          >
            <Ionicons name="flash-outline" size={18} color="#1DA1F2" />
            <Text style={styles.quickSignupButtonText}>Quick Test Signup</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Link href="/login" asChild>
              <TouchableOpacity disabled={isLoading}>
                <Text style={styles.loginLink}>Log in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>What happens after signup?</Text>
          <View style={styles.infoItem}>
            <Ionicons name="arrow-forward" size={16} color="#1DA1F2" />
            <Text style={styles.infoText}>
              Create your account instantly
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="arrow-forward" size={16} color="#1DA1F2" />
            <Text style={styles.infoText}>
              Redirect to profile setup (add photo & bio)
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="arrow-forward" size={16} color="#1DA1F2" />
            <Text style={styles.infoText}>
              Start connecting with friends!
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By signing up, you agree to our Terms and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1DA1F2',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#1a1a1a',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  inputIcon: {
    padding: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 12,
    fontSize: 16,
    color: '#1a1a1a',
  },
  eyeIcon: {
    padding: 12,
  },
  signupButton: {
    backgroundColor: '#1DA1F2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#1DA1F2',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  signupButtonDisabled: {
    backgroundColor: '#a0d2f7',
    shadowOpacity: 0,
    elevation: 0,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickSignupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1DA1F2',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: '#F0F8FF',
  },
  quickSignupButtonText: {
    color: '#1DA1F2',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e1e8ed',
  },
  dividerText: {
    paddingHorizontal: 16,
    color: '#666',
    fontSize: 14,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  loginText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#1DA1F2',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoSection: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 20,
  },
  footerText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});