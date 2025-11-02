import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { useAuth } from '../../contexts/AuthContext';
import { apiRequest } from '../../utils/api';
import { formatDate, getStatusColor } from '../../utils/formatting';
import '../../styles/common.css';
import './AdminSupportPage.css';

interface Message {
  message_id: number;
  content: string;
  sender: 'user' | 'admin';
  sender_id: string;
  timestamp: string;
}

interface Ticket {
  ticket_id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at?: string;
  project_id: string;
  user_email: string;
  project_filename?: string;
  messages?: Message[];
}

const AdminSupportPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Redirect if not admin
    if (!isAdmin) {
      navigate('/signin');
      return;
    }
    fetchAllTickets();
  }, [isAdmin, navigate]);

  useEffect(() => {
    // Apply filters
    let filtered = tickets;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ticket =>
        ticket.subject.toLowerCase().includes(query) ||
        ticket.user_email.toLowerCase().includes(query) ||
        ticket.project_filename?.toLowerCase().includes(query) ||
        ticket.project_id.toLowerCase().includes(query)
      );
    }

    setFilteredTickets(filtered);
  }, [tickets, statusFilter, searchQuery]);

  const fetchAllTickets = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ tickets: Ticket[] }>('/api/admin/tickets');
      setTickets(data.tickets || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setError('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetails = async (ticketId: string) => {
    try {
      const data = await apiRequest<Ticket>(`/api/admin/ticket/${ticketId}`);
      setSelectedTicket(data);
      setNewStatus(data.status);
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      setError('Failed to load ticket details');
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      setError('');
      setSuccessMessage('');
      await apiRequest(`/api/admin/ticket/${selectedTicket.ticket_id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message: replyMessage }),
      });

      setSuccessMessage('Reply sent successfully');
      setReplyMessage('');
      // Refresh ticket details
      await fetchTicketDetails(selectedTicket.ticket_id);
      // Refresh tickets list to update status
      await fetchAllTickets();
    } catch (error) {
      console.error('Error sending reply:', error);
      setError('Failed to send reply');
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedTicket || newStatus === selectedTicket.status) return;

    try {
      setError('');
      setSuccessMessage('');
      await apiRequest(`/api/admin/ticket/${selectedTicket.ticket_id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      setSuccessMessage('Status updated successfully');
      // Refresh ticket details
      await fetchTicketDetails(selectedTicket.ticket_id);
      // Refresh tickets list
      await fetchAllTickets();
    } catch (error) {
      console.error('Error updating status:', error);
      setError('Failed to update status');
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="admin-support-page">
      <Banner />

      <div className="admin-container">
        {/* Admin Navigation */}
        <div className="admin-nav">
          <h2>Admin Panel</h2>
          <div className="admin-nav-links">
            <a href="/admin/support" className="active">Support Tickets</a>
          </div>
        </div>

        <section className="admin-support-section">
          <div className="section-header">
            <h1>Support Tickets Management</h1>
            <p>View and respond to all support tickets across all projects</p>
          </div>

          {/* Filters */}
          <div className="filters-bar">
            <div className="filter-group">
              <label>Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Search:</label>
              <input
                type="text"
                placeholder="Search by subject, user, or project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Messages */}
          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}

          {/* Tickets List */}
          <div className="tickets-container">
            {loading ? (
              <p className="loading-text">Loading tickets...</p>
            ) : filteredTickets.length === 0 ? (
              <div className="no-tickets">
                <p>{searchQuery || statusFilter !== 'all' ? 'No tickets match your filters' : 'No support tickets yet'}</p>
              </div>
            ) : (
              <div className="tickets-table">
                <table>
                  <thead>
                    <tr>
                      <th>Project ID</th>
                      <th>Subject</th>
                      <th>User</th>
                      <th>Project</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((ticket) => (
                      <tr key={ticket.ticket_id} className={selectedTicket?.ticket_id === ticket.ticket_id ? 'selected' : ''}>
                        <td className="project-id">{ticket.project_id.substring(0, 8)}...</td>
                        <td>{ticket.subject}</td>
                        <td>{ticket.user_email}</td>
                        <td>{ticket.project_filename || 'Unknown'}</td>
                        <td>
                          <span className={`status-badge ${getStatusColor(ticket.status)}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>{formatDate(ticket.created_at)}</td>
                        <td>
                          <button
                            className="view-btn"
                            onClick={() => {
                              if (selectedTicket?.ticket_id === ticket.ticket_id) {
                                setSelectedTicket(null);
                              } else {
                                fetchTicketDetails(ticket.ticket_id);
                              }
                            }}
                          >
                            {selectedTicket?.ticket_id === ticket.ticket_id ? 'Close' : 'View'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Selected Ticket Detail */}
          {selectedTicket && (
            <div className="ticket-detail">
              <div className="ticket-detail-header">
                <h2>{selectedTicket.subject}</h2>
                <div className="ticket-meta">
                  <span>User: {selectedTicket.user_email}</span>
                  <span>Project: {selectedTicket.project_filename || selectedTicket.project_id}</span>
                  <span>Created: {formatDate(selectedTicket.created_at)}</span>
                </div>
              </div>

              {/* Messages */}
              <div className="messages-container">
                <h3>Conversation History</h3>
                {selectedTicket.messages?.map((message) => (
                  <div
                    key={message.message_id}
                    className={`message ${message.sender === 'admin' ? 'admin-message' : 'user-message'}`}
                  >
                    <div className="message-header">
                      <span className="sender-name">
                        {message.sender === 'admin' ? `Admin (${message.sender_id})` : 'User'}
                      </span>
                      <span className="message-time">
                        {formatDate(message.timestamp)}
                      </span>
                    </div>
                    <div className="message-content">
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>

              {/* Admin Actions */}
              <div className="admin-actions">
                {/* Status Update */}
                <div className="status-update">
                  <label>Update Status:</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button
                    onClick={handleStatusUpdate}
                    disabled={newStatus === selectedTicket.status}
                    className="update-status-btn"
                  >
                    Update Status
                  </button>
                </div>

                {/* Reply Form */}
                {(selectedTicket.status === 'open' || selectedTicket.status === 'in_progress') && (
                  <form className="reply-form" onSubmit={handleReply}>
                    <label>Reply to Ticket:</label>
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your reply..."
                      minLength={10}
                      maxLength={2000}
                      required
                      rows={5}
                    />
                    <div className="reply-form-footer">
                      <button type="submit" className="send-reply-btn">
                        Send Reply
                      </button>
                    </div>
                  </form>
                )}

                {(selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') && (
                  <div className="ticket-closed-notice">
                    This ticket is {selectedTicket.status}. Change the status to reopen it for replies.
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default AdminSupportPage;