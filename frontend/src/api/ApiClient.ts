import { ApiError, NetworkError, ValidationError, ServerError } from './apiErrors';
import { notificationService } from './notificationService';

interface RequestOptions extends RequestInit {
  // Add custom options if needed, e.g., 'skipAuth', 'skipErrorNotification'
  skipErrorNotification?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });

      if (!response.ok) {
        await this.handleErrorResponse(response, options?.skipErrorNotification);
      }

      // Assuming all successful responses return JSON
      return (await response.json()) as T;
    } catch (error) {
      this.handleRequestError(error, options?.skipErrorNotification);
      throw error; // Re-throw to propagate the error further if needed
    }
  }

  private async handleErrorResponse(response: Response, skipNotification?: boolean): Promise<void> {
    const { status, statusText } = response;
    let errorMessage = `Request failed with status ${status}: ${statusText}`;

    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      }
      if (status === 400 || status === 422) { // Common status codes for validation errors
        const validationErrors = errorData.errors || {};
        if (!skipNotification) {
          notificationService.warning(errorMessage);
        }
        throw new ValidationError(errorMessage, validationErrors, status);
      }
    } catch (parseError) {
      // If response is not JSON or parsing fails, use generic message
      console.error('Error parsing error response:', parseError);
    }

    if (!skipNotification) {
      notificationService.error(errorMessage);
    }

    if (status >= 500) {
      throw new ServerError(errorMessage, status);
    } else {
      throw new ApiError(errorMessage, status);
    }
  }

  private handleRequestError(error: unknown, skipNotification?: boolean): void {
    if (error instanceof TypeError) { // Network errors, e.g., 'Failed to fetch'
      if (!skipNotification) {
        notificationService.error('Network error. Please check your internet connection.');
      }
      throw new NetworkError();
    } else if (error instanceof ApiError) {
      // Already handled by handleErrorResponse, just re-throw
      throw error;
    } else {
      // Catch-all for unexpected errors
      console.error('An unexpected error occurred:', error);
      if (!skipNotification) {
        notificationService.error('An unexpected error occurred. Please try again.');
      }
      throw new Error('An unexpected error occurred.');
    }
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, data: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) });
  }

  public put<T>(endpoint: string, data: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) });
  }

  public delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Export a default instance configured for your backend API
// You might want to make this configurable based on environment (dev/prod)
export const api = new ApiClient(import.meta.env.VITE_API_BASE_URL || '/api');
