import { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/stores/notificationStore';
import type { Notification } from '@/services/notification.service';
import {
  getRecentNotifications,
  markAsRead as markAsReadApi,
  markAllAsRead as markAllAsReadApi,
  deleteNotification as deleteNotificationApi,
} from '@/services/notification.service';

export function NotificationDropdown() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  
  const {
    notifications,
    unreadCount,
    setNotifications,
    setUnreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
  } = useNotificationStore();
  
  // Fetch notifications on mount
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        setIsLoading(true);
        const data = await getRecentNotifications(15);
        if (Array.isArray(data)) {
          setNotifications(data);
          // Calculate unread count
          const unread = data.filter((n: Notification) => !n.isRead).length;
          setUnreadCount(unread);
        }
      } catch (error) {
        // Silently fail - notifications are not critical
        console.warn('Could not fetch notifications:', error);
        setNotifications([]);
        setUnreadCount(0);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadNotifications();
  }, [setNotifications, setUnreadCount]);
  
  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markAsReadApi(notificationId);
      markAsRead(notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };
  
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadApi();
      markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };
  
  const handleDelete = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteNotificationApi(notificationId);
      removeNotification(notificationId);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };
  
  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    // Mark as read if not already
    if (!notification.isRead) {
      try {
        await markAsReadApi(notification.id);
        markAsRead(notification.id);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
    
    // Navigate if there's a link
    if (notification.linkUrl) {
      navigate(notification.linkUrl);
    }
  };
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'processing_complete':
        return '✅';
      case 'deadline_reminder':
        return '⏰';
      case 'quiz_passed':
        return '🎉';
      case 'streak_reminder':
        return '🔥';
      case 'badge_earned':
        return '🏆';
      default:
        return '📌';
    }
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'px-4 py-3 hover:bg-muted cursor-pointer border-b last:border-b-0 transition-colors',
                    !notification.isRead && 'bg-primary/5'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">
                      {getNotificationIcon(notification.type)}
                    </span>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          'text-sm',
                          !notification.isRead && 'font-medium'
                        )}>
                          {notification.title}
                        </p>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => handleMarkAsRead(notification.id, e)}
                              title="Mark as read"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={(e) => handleDelete(notification.id, e)}
                            title="Delete"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      
                      <p className="text-xs text-muted-foreground mt-1">
                        {(() => {
                          try {
                            const date = parseISO(notification.createdAt);
                            return isValid(date) 
                              ? formatDistanceToNow(date, { addSuffix: true })
                              : 'Recently';
                          } catch {
                            return 'Recently';
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
