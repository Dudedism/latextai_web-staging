import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { getAuthenticatedUser, isAdmin, getToken } from '../../utils/auth';
import '../../styles/common.css';
import './AdminProjectsPage.css';

interface Project {
  project_id: string;
  user_email: string;
  upload_filename: string;
  template: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

const AdminProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const user = getAuthenticatedUser();
  const isUserAdmin = isAdmin();

  useEffect(() => {
    // Redirect if not admin
    if (!isUserAdmin) {
      navigate('/signin');
      return;
    }
    fetchAllProjects();
  }, [isUserAdmin, navigate]);

  useEffect(() => {
    // Apply filters
    let filtered = projects;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.project_id.toLowerCase().includes(query) ||
        project.user_email.toLowerCase().includes(query) ||
        project.upload_filename.toLowerCase().includes(query) ||
        project.template.toLowerCase().includes(query)
      );
    }

    setFilteredProjects(filtered);
  }, [projects, statusFilter, searchQuery]);

  const fetchAllProjects = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const response = await fetch('http://localhost:8000/api/admin/projects', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      } else {
        setError('Failed to load projects');
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadArchive = async (projectId: string) => {
    try {
      const token = getToken();
      const response = await fetch(`http://localhost:8000/api/admin/project/${projectId}/archive`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `project_${projectId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setSuccessMessage('Project downloaded successfully');
      } else {
        setError('Failed to download project');
      }
    } catch (error) {
      console.error('Error downloading project:', error);
      setError('Failed to download project');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      setError('');
      setSuccessMessage('');
      const token = getToken();
      const response = await fetch(`http://localhost:8000/api/admin/project/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setSuccessMessage('Project deleted successfully');
        setDeleteConfirm(null);
        // Refresh projects list
        await fetchAllProjects();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      setError('Failed to delete project');
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  return (
    <div className="admin-projects-page">
      <Banner isAuthenticated={true} userName={user?.name} />

      <div className="admin-container">
        {/* Admin Navigation */}
        <div className="admin-nav">
          <h2>Admin Panel</h2>
          <div className="admin-nav-links">
            <a href="/admin/support">Support Tickets</a>
            <a href="/admin/projects" className="active">Projects</a>
          </div>
        </div>

        <section className="admin-projects-section">
          <div className="section-header">
            <h1>Project Management</h1>
            <p>View and manage all user projects</p>
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
                <option value="unconverted">Unconverted</option>
                <option value="converted">Converted</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Search:</label>
              <input
                type="text"
                placeholder="Search by ID, user, filename, or template..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Messages */}
          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}

          {/* Projects List */}
          <div className="projects-container">
            {loading ? (
              <p className="loading-text">Loading projects...</p>
            ) : filteredProjects.length === 0 ? (
              <div className="no-projects">
                <p>{searchQuery || statusFilter !== 'all' ? 'No projects match your filters' : 'No projects yet'}</p>
              </div>
            ) : (
              <div className="projects-table">
                <table>
                  <thead>
                    <tr>
                      <th>Project ID</th>
                      <th>User Email</th>
                      <th>Filename</th>
                      <th>Template</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((project) => (
                      <tr key={project.project_id}>
                        <td className="project-id">{project.project_id.substring(0, 8)}...</td>
                        <td>{project.user_email}</td>
                        <td>{project.upload_filename}</td>
                        <td>{project.template}</td>
                        <td>
                          <span className={`status-badge status-${project.status}`}>
                            {formatStatus(project.status)}
                          </span>
                        </td>
                        <td>{formatDate(project.created_at)}</td>
                        <td className="actions-cell">
                          <div className="action-buttons">
                            <button
                              className="action-btn view-btn"
                              onClick={() => navigate(`/admin/projects/${project.project_id}`)}
                              title="View Details"
                            >
                              View Details
                            </button>
                            <button
                              className="action-btn download-btn"
                              onClick={() => handleDownloadArchive(project.project_id)}
                              title="Download Archive"
                            >
                              Download
                            </button>
                            {deleteConfirm === project.project_id ? (
                              <div className="delete-confirm">
                                <span>Are you sure?</span>
                                <button
                                  className="confirm-yes"
                                  onClick={() => handleDeleteProject(project.project_id)}
                                >
                                  Yes
                                </button>
                                <button
                                  className="confirm-no"
                                  onClick={() => setDeleteConfirm(null)}
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                className="action-btn delete-btn"
                                onClick={() => setDeleteConfirm(project.project_id)}
                                title="Delete Project"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default AdminProjectsPage;