export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {},
  authToken?: string,
  logoutFn?: () => void
): Promise<Response> => {
  try {
    // Add authorization header if token is provided
    const headers = {
      ...(options.headers || {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Check for unauthorized response
    if (response.status === 401) {
      console.log('Unauthorized request - logging out');
      if (logoutFn) {
        logoutFn();
      } else {
        console.error('Logout function not available');
      }
      throw new Error('Unauthorized - logged out');
    }

    return response;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};
