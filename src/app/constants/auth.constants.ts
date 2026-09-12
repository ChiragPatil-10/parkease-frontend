export const AUTH_API = {
  login: '/api/v1/auth/login',
  registerDriver: '/api/v1/auth/register/driver',
  registerManager: '/api/v1/auth/register/manager',
  userById: (id: string) => `/api/v1/auth/users/${id}`,
  managerApplications: '/api/v1/admin/manager-applications',
  approveManager: (applicationId: string) => `/api/v1/admin/approve-manager/${applicationId}`,
  rejectManager: (applicationId: string) => `/api/v1/admin/reject-manager/${applicationId}`,
} as const;
