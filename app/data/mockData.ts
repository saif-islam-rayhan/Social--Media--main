// Mock data for posts
export const initialPosts = [
  {
    id: '1',
    username: 'technews',
    name: 'Tech News Daily',
    content: 'Breaking: New AI model breaks all performance records...',
    likes: 324,
    comments: 45,
    time: '1h ago',
    userImage: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=400&fit=crop',
    image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=600&fit=crop',
    isLiked: false,
    commentsList: []
  },
  {
    id: '2',
    username: 'climatewatch',
    name: 'Climate Watch',
    content: 'Major breakthrough in renewable energy...',
    likes: 512,
    comments: 89,
    time: '2h ago',
    userImage: 'https://images.unsplash.com/photo-1569163139394-de4e4f43e4e3?w=400&h=400&fit=crop',
    image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&h=600&fit=crop',
    isLiked: false,
    commentsList: []
  },
  // ... more posts
];

// Mock data for stories
export const stories = [
  {
    id: '1',
    username: 'Your Story',
    isUser: true,
    hasNewStory: true,
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face'
  },
  {
    id: '2',
    username: 'johndoe',
    hasNewStory: true,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
  },
  // ... more stories
];

// Types
export type Post = {
  id: string;
  username: string;
  name: string;
  content: string;
  likes: number;
  comments: number;
  time: string;
  userImage: string;
  image: string;
  isLiked: boolean;
  commentsList: Array<{
    id: string;
    username: string;
    name: string;
    comment: string;
    time: string;
  }>;
};

export type Story = {
  id: string;
  username: string;
  isUser?: boolean;
  hasNewStory: boolean;
  avatar: string;
};