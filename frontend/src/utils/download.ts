import { apiFetch } from './api';

/**
 * Downloads a file from the API and triggers browser download
 * @param endpoint - API endpoint to fetch the file from
 * @param filename - Filename to save as
 * @param options - Additional fetch options
 */
export const downloadFile = async (
  endpoint: string,
  filename: string,
  options?: RequestInit
): Promise<void> => {
  const response = await apiFetch(endpoint, options);

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
