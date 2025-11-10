// types/notification.ts
export interface NotificationUser {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  profilePicture?: string;
}

export interface Notification {
  id: string;
  type: 'friend_request' | 'like' | 'comment' | 'friend_request_accepted' | 'mention';
  user: NotificationUser;
  time: string;
  read: boolean;
  content?: string;
  postId?: string;
  commentId?: string;
  createdAt: string;
}

export interface FriendRequestAction {
  notificationId: string;
  action: 'accept' | 'decline';
}