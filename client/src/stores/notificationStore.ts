import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { Notification } from '../services/notification.service';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  socket: Socket | null;
  isConnected: boolean;
  
  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  setUnreadCount: (count: number) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
  
  // WebSocket actions
  connect: (userId: string) => void;
  disconnect: () => void;
}

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  socket: null,
  isConnected: false,
  
  setNotifications: (notifications) => set({ notifications }),
  
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications],
    unreadCount: state.unreadCount + (notification.isRead ? 0 : 1),
  })),
  
  setUnreadCount: (count) => set({ unreadCount: count }),
  
  markAsRead: (notificationId) => set((state) => ({
    notifications: state.notifications.map((n) =>
      n.id === notificationId ? { ...n, isRead: true } : n
    ),
    unreadCount: Math.max(0, state.unreadCount - 1),
  })),
  
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    unreadCount: 0,
  })),
  
  removeNotification: (notificationId) => set((state) => {
    const notification = state.notifications.find((n) => n.id === notificationId);
    return {
      notifications: state.notifications.filter((n) => n.id !== notificationId),
      unreadCount: notification && !notification.isRead
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    };
  }),
  
  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
  
  connect: (userId) => {
    const { socket } = get();
    
    // Don't reconnect if already connected
    if (socket?.connected) {
      return;
    }
    
    // Disconnect existing socket if any
    if (socket) {
      socket.disconnect();
    }
    
    try {
      // Create new socket connection
      const newSocket = io(SOCKET_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling'], // Prefer websocket, fallback to polling
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });
      
      newSocket.on('connect', () => {
        console.log('WebSocket connected');
        set({ isConnected: true });
        
        // Authenticate with userId
        newSocket.emit('authenticate', userId);
      });
      
      newSocket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        set({ isConnected: false });
        
        // If disconnected due to server issues, socket.io will auto-reconnect
        // For manual disconnect, we don't want to reconnect
        if (reason === 'io server disconnect') {
          // Server disconnected us, try to reconnect
          newSocket.connect();
        }
      });
      
      newSocket.on('connect_error', (error) => {
        console.warn('WebSocket connection error (will retry):', error.message);
        set({ isConnected: false });
      });
      
      newSocket.on('reconnect', (attemptNumber) => {
        console.log('WebSocket reconnected after', attemptNumber, 'attempts');
        set({ isConnected: true });
        // Re-authenticate after reconnection
        newSocket.emit('authenticate', userId);
      });
      
      newSocket.on('reconnect_failed', () => {
        console.warn('WebSocket reconnection failed after all attempts');
        set({ isConnected: false });
      });
      
      // Handle new notification
      newSocket.on('notification:new', (notification: Notification) => {
        get().addNotification(notification);
      });
      
      // Handle unread count update
      newSocket.on('notification:unreadCount', ({ count }: { count: number }) => {
        set({ unreadCount: count });
      });
      
      // Handle notification update
      newSocket.on('notification:updated', ({ id, isRead }: { id: string; isRead: boolean }) => {
        if (isRead) {
          get().markAsRead(id);
        }
      });
      
      // Handle all read
      newSocket.on('notification:allRead', () => {
        get().markAllAsRead();
      });
      
      // Handle job progress events
      newSocket.on('job:progress', (data: {
        jobId: string;
        progress: number;
        status: string;
        materialId?: string;
      }) => {
        console.log('Job progress:', data);
      });
      
      // Handle job completion
      newSocket.on('job:complete', (data: {
        jobId: string;
        materialId?: string;
        textLength?: number;
        chunksCreated?: number;
      }) => {
        console.log('Job completed:', data);
      });
      
      // Handle job failure
      newSocket.on('job:failed', (data: { jobId: string; error: string }) => {
        console.error('Job failed:', data);
      });
      
      set({ socket: newSocket });
    } catch (error) {
      console.warn('Failed to initialize WebSocket:', error);
    }
  },
  
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },
}));
