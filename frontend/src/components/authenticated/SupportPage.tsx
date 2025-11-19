import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { apiRequest } from '../../utils/api';
import { formatDate, getStatusColor } from '../../utils/formatting';
import '../../styles/common.css';
import './SupportPage.css';

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
  message_count?: number;
  messages?: Message[];
}

interface Project {
  project_id: string;
  upload_filename: string;
}

const SupportPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    if (projectId) {
      fetchProjectAndTickets();
    }
  }, [projectId]);

  const fetchProjectAndTickets = async () => {
    try {
      // Fetch project details
      const projectData = await apiRequest<Project>(`/api/latex/project/${projectId}`);
      setProject({
        project_id: projectData.project_id,
        upload_filename: projectData.upload_filename
      });

      // Fetch tickets for this project
      const ticketsData = await apiRequest<{ tickets: Ticket[] }>(`/api/latex/project/${projectId}/tickets`);
      setTickets(ticketsData.tickets || []);
    } catch (error) {
      console.error('Error fetching project and tickets:', error);
      setError('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetails = async (ticketId: string) => {
    try {
      const ticketData = await apiRequest<Ticket>(`/api/latex/ticket/${ticketId}`);
      setSelectedTicket(ticketData);
      // Count user messages for rate limiting display
      const userMessages = ticketData.messages?.filter((m: Message) => m.sender === 'user') || [];
      const recentMessages = userMessages.filter((m: Message) => {
        const msgTime = new Date(m.timestamp).getTime();
        const hourAgo = Date.now() - 3600000;
        return msgTime > hourAgo;
      });
      setMessageCount(recentMessages.length);
    } catch (error) {
      console.error('Error fetching ticket details:', error);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await apiRequest(`/api/latex/project/${projectId}/support`, {
        method: 'POST',
        body: JSON.stringify({
          subject: newTicketSubject,
          message: newTicketMessage,
        }),
      });

      // Reset form and refresh tickets
      setNewTicketSubject('');
      setNewTicketMessage('');
      setShowCreateForm(false);
      await fetchProjectAndTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
      setError('Failed to create ticket');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      await apiRequest(`/api/latex/ticket/${selectedTicket.ticket_id}/message`, {
        method: 'POST',
        body: JSON.stringify({ message: newMessage }),
      });

      setNewMessage('');
      // Refresh ticket details
      await fetchTicketDetails(selectedTicket.ticket_id);
    } catch (error: any) {
      console.error('Error sending message:', error);
      if (error.message?.includes('429')) {
        setError('Rate limit reached. You can only send 5 messages per hour.');
      } else {
        setError('Failed to send message');
      }
    }
  };

  const hasOpenTicket = tickets.some(t => t.status === 'open' || t.status === 'in_progress');

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="support-page">
      <Banner />

      <section className="support-main-section">
        <div className="support-container">
          {/* Header Section */}
          <div className="support-header">
            <h1>Support Tickets for {project?.upload_filename || 'Your Project'}</h1>
            <p className="support-info">
              You can create multiple support tickets for this project. Only one ticket can be open at a time.
            </p>

            {hasOpenTicket ? (
              <div className="open-ticket-warning">
                Please close your current open ticket before creating a new one
              </div>
            ) : (
              <button
                className="create-ticket-btn"
                onClick={() => setShowCreateForm(true)}
                disabled={showCreateForm}
              >
                Create New Ticket
              </button>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Create Ticket Form */}
          {showCreateForm && !hasOpenTicket && (
            <div className="create-ticket-form">
              <form onSubmit={handleCreateTicket}>
                <div className="form-group">
                  <label htmlFor="subject">Subject (5-30 characters)</label>
                  <input
                    type="text"
                    id="subject"
                    value={newTicketSubject}
                    onChange={(e) => setNewTicketSubject(e.target.value)}
                    minLength={5}
                    maxLength={30}
                    required
                    placeholder="Brief description of your issue"
                  />
                  <span className="char-count">{newTicketSubject.length}/30</span>
                </div>

                <div className="form-group">
                  <label htmlFor="message">Message (10-2000 characters)</label>
                  <textarea
                    id="message"
                    value={newTicketMessage}
                    onChange={(e) => setNewTicketMessage(e.target.value)}
                    minLength={10}
                    maxLength={2000}
                    required
                    placeholder="Describe your issue in detail"
                    rows={6}
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="submit-btn">Submit Ticket</button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewTicketSubject('');
                      setNewTicketMessage('');
                      setError('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tickets List */}
          <div className="tickets-section">
            {loading ? (
              <p className="loading-text">Loading tickets...</p>
            ) : tickets.length === 0 ? (
              <div className="no-tickets">
                <p>No support tickets yet</p>
                {!hasOpenTicket && (
                  <button
                    className="create-first-ticket-btn"
                    onClick={() => setShowCreateForm(true)}
                  >
                    Create Your First Ticket
                  </button>
                )}
              </div>
            ) : (
              <div className="tickets-list">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.ticket_id}
                    className={`ticket-card ${selectedTicket?.ticket_id === ticket.ticket_id ? 'expanded' : ''}`}
                  >
                    <div
                      className="ticket-header"
                      onClick={() => {
                        if (selectedTicket?.ticket_id === ticket.ticket_id) {
                          setSelectedTicket(null);
                        } else {
                          fetchTicketDetails(ticket.ticket_id);
                        }
                      }}
                    >
                      <h3 className="ticket-subject">{ticket.subject}</h3>
                      <div className="ticket-meta">
                        <span className={`status-badge ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                        <span className="ticket-date">{formatDate(ticket.created_at)}</span>
                      </div>
                    </div>

                    {/* Expanded Ticket View */}
                    {selectedTicket?.ticket_id === ticket.ticket_id && (
                      <div className="ticket-details">
                        <div className="messages-container">
                          {selectedTicket.messages?.map((message) => (
                            <div
                              key={message.message_id}
                              className={`message ${message.sender === 'admin' ? 'admin-message' : 'user-message'}`}
                            >
                              <div className="message-header">
                                <span className="sender-name">
                                  {message.sender === 'admin' ? 'Support Team' : 'You'}
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

                        {/* Add Message Form */}
                        {(selectedTicket.status === 'open' || selectedTicket.status === 'in_progress') && (
                          <form className="add-message-form" onSubmit={handleSendMessage}>
                            <textarea
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder="Type your message..."
                              minLength={10}
                              maxLength={2000}
                              required
                              rows={4}
                            />
                            <div className="message-form-footer">
                              {messageCount >= 4 && (
                                <span className="rate-limit-warning">
                                  {5 - messageCount} message(s) remaining this hour
                                </span>
                              )}
                              <button type="submit" className="send-message-btn">
                                Send Message
                              </button>
                            </div>
                          </form>
                        )}

                        {(selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') && (
                          <div className="ticket-closed-notice">
                            This ticket is closed and cannot receive new messages.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SupportPage;