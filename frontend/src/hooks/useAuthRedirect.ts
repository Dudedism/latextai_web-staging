/**
 * Auth redirect hook - currently a no-op since fetchInterceptor handles
 * automatic redirects to /signin when API requests fail with 401.
 *
 * Kept for potential future use.
 */
const useAuthRedirect = () => {
  // No-op: fetchInterceptor handles authentication redirects automatically
};

export default useAuthRedirect;