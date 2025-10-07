import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { getAuthenticatedUser, isAdmin, getToken } from '../../utils/auth';
import '../../styles/common.css';
import './AdminProjectDetailPage.css';

interface ProjectFile {
  filename: string;
  size: number;
  last_modified: string;
  path: string;
}

interface ProjectDetails {
  project_id: string;
  user_email: string;
  upload_filename: string;
  template: string;
  status: string;
  created_at: string;
  updated_at?: string;
  files: ProjectFile[];
}

const AdminProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [customFilename, setCustomFilename] = useState('');
  const [uploading, setUploading] = useState(false);

  const user = getAuthenticatedUser();
  const isUserAdmin = isAdmin();

  useEffect(() => {
    // Redirect if not admin
    if (!isUserAdmin) {
      navigate('/signin');
      return;
    }
    if (projectId) {
      fetchProjectDetails();
    }
  }, [isUserAdmin, navigate, projectId]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const response = await fetch(`http://localhost:8000/api/admin/project/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data);
      } else {
        setError('Failed to load project details');
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
      setError('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = async (filename: string) => {
    try {
      const token = getToken();
      const response = await fetch(`http://localhost:8000/api/admin/project/${projectId}/file/${encodeURIComponent(filename)}`, {
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
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setSuccessMessage(`Downloaded ${filename}`);
      } else {
        setError('Failed to download file');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      setError('Failed to download file');
    }
  };

  const handleDeleteFile = async (filename: string) => {
    // Check if it's the last file
    if (project && project.files.length === 1) {
      setError('Cannot delete the last file in the project');
      setDeleteConfirm(null);
      return;
    }

    try {
      setError('');
      setSuccessMessage('');
      const token = getToken();
      const response = await fetch(`http://localhost:8000/api/admin/project/${projectId}/file/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setSuccessMessage(`Deleted ${filename}`);
        setDeleteConfirm(null);
        // Refresh project details
        await fetchProjectDetails();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      setError('Failed to delete file');
    }
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = getToken();
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (customFilename) {
        formData.append('filename', customFilename);
      }

      const response = await fetch(`http://localhost:8000/api/admin/project/${projectId}/file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setSuccessMessage(`Uploaded ${data.filename} successfully`);
        setUploadFile(null);
        setCustomFilename('');
        // Reset file input
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        // Refresh project details
        await fetchProjectDetails();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '📄';
      case 'docx':
      case 'doc': return '📝';
      case 'tex': return '📜';
      case 'txt': return '📃';
      case 'png':
      case 'jpg':
      case 'jpeg': return '🖼️';
      case 'zip': return '📦';
      default: return '📎';
    }
  };

  if (!isUserAdmin) {
    return null;
  }

  return (
    <div className="admin-project-detail-page">
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

        <section className="admin-project-detail-section">
          {/* Back Button */}
          <button
            className="back-button"
            onClick={() => navigate('/admin/projects')}
          >
            ← Back to Projects
          </button>

          {loading ? (
            <p className="loading-text">Loading project details...</p>
          ) : !project ? (
            <div className="no-project">
              <p>Project not found</p>
            </div>
          ) : (
            <>
              {/* Project Header */}
              <div className="project-header">
                <h1>Project Details</h1>
                <p className="project-id">ID: {project.project_id}</p>
              </div>

              {/* Messages */}
              {error && <div className="error-message">{error}</div>}
              {successMessage && <div className="success-message">{successMessage}</div>}

              {/* Project Metadata */}
              <div className="project-metadata">
                <h2>Project Information</h2>
                <div className="metadata-grid">
                  <div className="metadata-item">
                    <label>User Email:</label>
                    <span>{project.user_email}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Upload Filename:</label>
                    <span>{project.upload_filename}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Template:</label>
                    <span>{project.template}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Status:</label>
                    <span className={`status-badge status-${project.status}`}>
                      {formatStatus(project.status)}
                    </span>
                  </div>
                  <div className="metadata-item">
                    <label>Created:</label>
                    <span>{formatDate(project.created_at)}</span>
                  </div>
                  {project.updated_at && (
                    <div className="metadata-item">
                      <label>Updated:</label>
                      <span>{formatDate(project.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* File Upload Section */}
              <div className="file-upload-section">
                <h2>Upload File</h2>
                <form onSubmit={handleUploadFile} className="upload-form">
                  <div className="form-group">
                    <label htmlFor="file-upload">Select File:</label>
                    <input
                      type="file"
                      id="file-upload"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="custom-filename">Custom Filename (optional):</label>
                    <input
                      type="text"
                      id="custom-filename"
                      value={customFilename}
                      onChange={(e) => setCustomFilename(e.target.value)}
                      placeholder="Leave empty to use original filename"
                    />
                  </div>
                  <button
                    type="submit"
                    className="upload-btn"
                    disabled={!uploadFile || uploading}
                  >
                    {uploading ? 'Uploading...' : 'Upload File'}
                  </button>
                </form>
              </div>

              {/* Files Management */}
              <div className="files-section">
                <h2>Project Files ({project.files.length})</h2>
                {project.files.length === 0 ? (
                  <div className="no-files">
                    <p>No files in this project</p>
                  </div>
                ) : (
                  <div className="files-table">
                    <table>
                      <thead>
                        <tr>
                          <th></th>
                          <th>Filename</th>
                          <th>Size</th>
                          <th>Last Modified</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {project.files.map((file) => (
                          <tr key={file.filename}>
                            <td className="file-icon">{getFileIcon(file.filename)}</td>
                            <td className="file-name">{file.filename}</td>
                            <td>{formatFileSize(file.size)}</td>
                            <td>{formatDate(file.last_modified)}</td>
                            <td className="actions-cell">
                              <div className="file-actions">
                                <button
                                  className="file-action-btn download-btn"
                                  onClick={() => handleDownloadFile(file.filename)}
                                  title="Download"
                                >
                                  Download
                                </button>
                                {deleteConfirm === file.filename ? (
                                  <div className="delete-confirm">
                                    <span>Delete?</span>
                                    <button
                                      className="confirm-yes"
                                      onClick={() => handleDeleteFile(file.filename)}
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
                                    className="file-action-btn delete-btn"
                                    onClick={() => setDeleteConfirm(file.filename)}
                                    title="Delete"
                                    disabled={project.files.length === 1}
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
                    {project.files.length === 1 && (
                      <p className="warning-text">
                        Cannot delete the last file in the project
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default AdminProjectDetailPage;