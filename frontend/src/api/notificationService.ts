// This is a placeholder for a real notification service.
// In a real application, you would integrate with a UI notification library
// like react-toastify, notistack, or a custom solution.

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationOptions {
  duration?: number; // in milliseconds
  // Add other options like position, closable, etc.
}

const showNotification = (
  message: string,
  type: NotificationType = 'info',
  options?: NotificationOptions
) => {
  console.log(`[Notification - ${type.toUpperCase()}]: ${message}`, options);
  // In a real app, this would trigger a UI notification
  alert(`${type.toUpperCase()}: ${message}`);
};

export const notificationService = {
  success: (message: string, options?: NotificationOptions) =>
    showNotification(message, 'success', options),
  error: (message: string, options?: NotificationOptions) =>
    showNotification(message, 'error', options),
  info: (message: string, options?: NotificationOptions) =>
    showNotification(message, 'info', options),
  warning: (message: string, options?: NotificationOptions) =>
    showNotification(message, 'warning', options),
};
