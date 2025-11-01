/**
 * Formats a date string to a human-readable format
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Gets the CSS class name for a ticket status
 * @param status - Ticket status
 * @returns CSS class name
 */
export const getStatusColor = (status: string): string => {
  const statusMap: Record<string, string> = {
    open: 'status-open',
    in_progress: 'status-progress',
    resolved: 'status-resolved',
    closed: 'status-closed'
  };
  return statusMap[status] || '';
};
