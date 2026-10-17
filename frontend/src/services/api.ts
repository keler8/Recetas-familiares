const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');
  const activeHouseholdId = localStorage.getItem('active_household_id');

  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (activeHouseholdId && !headers.has('X-Household-ID')) {
    headers.set('X-Household-ID', activeHouseholdId);
  }

  // Do not set Content-Type if sending FormData (browser sets boundary)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // If unauthorized, clear token if expired
    if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/mfa/')) {
      localStorage.removeItem('token');
    }
  }

  if (!response.ok) {
    let errorDetail = 'Error en la petición';
    let data;
    try {
      data = await response.json();
      errorDetail = data.detail || data.message || errorDetail;
    } catch {
      // Not JSON
    }
    throw new ApiError(response.status, errorDetail, data);
  }

  // Check if response is empty
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response.text() as any;
}
