// TODO(EKA-06): validate required env values at startup.
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
}
