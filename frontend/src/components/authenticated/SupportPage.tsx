import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { apiRequest } from '../../utils/api';
import { formatDate } from '../../utils/formatting';

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

  const ticketCardStyle = (isExpanded: boolean): React.CSSProperties => ({
    background: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    boxShadow: isExpanded ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
  });

  const ticketHeaderStyle: React.CSSProperties = {
    padding: '20px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  };

  const messageStyle = (isAdmin: boolean): React.CSSProperties => ({
    padding: '16px',
    borderRadius: '12px',
    background: isAdmin ? '#f0f8ff' : '#f5f5f5',
    borderLeft: isAdmin ? '4px solid #2196f3' : '4px solid #999',
  });

  const getStatusBadgeStyle = (status: string): React.CSSProperties => {
    const colors: Record<string, { bg: string; color: string }> = {
      open: { bg: '#e8f5e9', color: '#2e7d32' },
      in_progress: { bg: '#fff3e0', color: '#e65100' },
      resolved: { bg: '#e3f2fd', color: '#1565c0' },
      closed: { bg: '#f5f5f5', color: '#666' },
    };
    const c = colors[status] || colors.closed;
    return {
      padding: '6px 14px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
      background: c.bg,
      color: c.color,
      textTransform: 'capitalize',
    };
  };

  return (
    <div className="page">
      <Banner />

      <section className="main-section">
        <div className="container container--lg">
          <div className="mb-8">
            <h1 className="section-title">Support Tickets for {project?.upload_filename || 'Your Project'}</h1>
            <p className="text-muted mb-6">
              You can create multiple support tickets for this project. Only one ticket can be open at a time.
            </p>

            {hasOpenTicket ? (
              <div className="notice notice--warning">
                Please close your current open ticket before creating a new one
              </div>
            ) : (
              <button
                className="btn btn--primary"
                onClick={() => setShowCreateForm(true)}
                disabled={showCreateForm}
              >
                Create New Ticket
              </button>
            )}
          </div>

          {error && (
            <div className="notice notice--error mb-6">
              {error}
            </div>
          )}

          {showCreateForm && !hasOpenTicket && (
            <div className="card mb-8" style={{ padding: '32px' }}>
              <form onSubmit={handleCreateTicket}>
                <div className="form-group">
                  <label className="form-label">Subject (5-30 characters)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={newTicketSubject}
                      onChange={(e) => setNewTicketSubject(e.target.value)}
                      minLength={5}
                      maxLength={30}
                      required
                      placeholder="Brief description of your issue"
                      className="form-input"
                    />
                    <span className="text-sm text-muted" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                      {newTicketSubject.length}/30
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Message (10-2000 characters)</label>
                  <textarea
                    value={newTicketMessage}
                    onChange={(e) => setNewTicketMessage(e.target.value)}
                    minLength={10}
                    maxLength={2000}
                    required
                    placeholder="Describe your issue in detail"
                    rows={6}
                    className="form-textarea"
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn--primary">Submit Ticket</button>
                  <button
                    type="button"
                    className="btn btn--secondary"
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

          <div>
            {tickets.length === 0 ? (
              <div className="text-center" style={{ padding: '60px 20px' }}>
                <p className="text-muted mb-6">No support tickets yet</p>
                {!hasOpenTicket && (
                  <button
                    className="btn btn--primary btn--lg"
                    onClick={() => setShowCreateForm(true)}
                  >
                    Create Your First Ticket
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {tickets.map((ticket) => (
                  <div key={ticket.ticket_id} style={ticketCardStyle(selectedTicket?.ticket_id === ticket.ticket_id)}>
                    <div
                      style={ticketHeaderStyle}
                      onClick={() => {
                        if (selectedTicket?.ticket_id === ticket.ticket_id) {
                          setSelectedTicket(null);
                        } else {
                          fetchTicketDetails(ticket.ticket_id);
                        }
                      }}
                    >
                      <h3 className="font-semibold" style={{ margin: 0, fontSize: '18px' }}>{ticket.subject}</h3>
                      <div className="flex items-center gap-4">
                        <span style={getStatusBadgeStyle(ticket.status)}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                        <span className="text-sm text-muted">{formatDate(ticket.created_at)}</span>
                      </div>
                    </div>

                    {selectedTicket?.ticket_id === ticket.ticket_id && (
                      <div style={{ padding: '0 20px 20px', borderTop: '1px solid #e0e0e0' }}>
                        <div className="flex flex-col gap-4 mt-6">
                          {selectedTicket.messages?.map((message) => (
                            <div key={message.message_id} style={messageStyle(message.sender === 'admin')}>
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-semibold text-sm">
                                  {message.sender === 'admin' ? 'Support Team' : 'You'}
                                </span>
                                <span className="text-sm text-muted">{formatDate(message.timestamp)}</span>
                              </div>
                              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{message.content}</div>
                            </div>
                          ))}
                        </div>

                        {(selectedTicket.status === 'open' || selectedTicket.status === 'in_progress') && (
                          <form className="mt-6" onSubmit={handleSendMessage}>
                            <textarea
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder="Type your message..."
                              minLength={10}
                              maxLength={2000}
                              required
                              rows={4}
                              className="form-textarea"
                            />
                            <div className="flex justify-between items-center mt-4">
                              {messageCount >= 4 && (
                                <span className="text-sm text-error">
                                  {5 - messageCount} message(s) remaining this hour
                                </span>
                              )}
                              <button type="submit" className="btn btn--primary" style={{ marginLeft: 'auto' }}>
                                Send Message
                              </button>
                            </div>
                          </form>
                        )}

                        {(selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') && (
                          <div className="notice notice--info mt-6">
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