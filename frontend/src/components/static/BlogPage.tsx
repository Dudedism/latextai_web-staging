import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiRequest } from '../../utils/api';
import Banner from '../Banner';
import Footer from '../Footer';
import './BlogPage.css';

interface BlogPost {
  _id: string;
  title: string;
  content: string;
  author_name: string;
  author_email: string;
  created_at: string;
  updated_at: string;
}

const BlogPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [canAuthor, setCanAuthor] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPosts();
    if (isAuthenticated) {
      checkCanAuthor();
    }
  }, [isAuthenticated]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<BlogPost[]>('/api/blog/posts');
      setPosts(data);
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkCanAuthor = async () => {
    try {
      const data = await apiRequest<{ can_author: boolean }>('/api/blog/can-author');
      setCanAuthor(data.can_author);
    } catch (err) {
      console.error('Error checking author status:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (editingPost) {
        await apiRequest(`/api/blog/posts/${editingPost._id}`, {
          method: 'PUT',
          body: JSON.stringify({ title, content })
        });
      } else {
        await apiRequest('/api/blog/posts', {
          method: 'POST',
          body: JSON.stringify({ title, content })
        });
      }
      
      setShowEditor(false);
      setEditingPost(null);
      setTitle('');
      setContent('');
      fetchPosts();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save post';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setTitle(post.title);
    setContent(post.content);
    setShowEditor(true);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    try {
      await apiRequest(`/api/blog/posts/${postId}`, { method: 'DELETE' });
      fetchPosts();
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="blog-container">
      <Banner />
      <div className="blog-bg-area">
      
      <main className="blog-main">
        <section className="blog-header">
          <h1 className="blog-title">News & Updates</h1>
          <p className="blog-subtitle">Stay up to date with the latest LaTexT developments</p>
          
          {canAuthor && !showEditor && (
            <button 
              className="blog-new-post-btn"
              onClick={() => {
                setShowEditor(true);
                setEditingPost(null);
                setTitle('');
                setContent('');
              }}
            >
              + New Post
            </button>
          )}
        </section>

        {showEditor && (
          <section className="blog-editor">
            <h2>{editingPost ? 'Edit Post' : 'New Post'}</h2>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Post title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="blog-editor-title"
                maxLength={200}
                required
              />
              <textarea
                placeholder="Write your post content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="blog-editor-content"
                rows={10}
                maxLength={50000}
                required
              />
              {error && <p className="blog-error">{error}</p>}
              <div className="blog-editor-actions">
                <button 
                  type="button" 
                  className="blog-cancel-btn"
                  onClick={() => {
                    setShowEditor(false);
                    setEditingPost(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="blog-submit-btn"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : (editingPost ? 'Update' : 'Publish')}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="blog-posts">
          {loading ? (
            <div className="blog-loading">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="blog-empty">
              <p>No posts yet. Check back soon for updates!</p>
            </div>
          ) : (
            posts.map((post) => (
              <article key={post._id} className="blog-post">
                <div className="blog-post-header">
                  <h2 className="blog-post-title">{post.title}</h2>
                  <div className="blog-post-meta">
                    <span className="blog-post-date">{formatDate(post.created_at)}</span>
                    <span className="blog-post-author">by {post.author_name.split(' ')[0]}</span>
                  </div>
                </div>
                <div className="blog-post-content">
                  {post.content.split('\n').map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>
                {canAuthor && (
                  <div className="blog-post-actions">
                    <button 
                      className="blog-edit-btn"
                      onClick={() => handleEdit(post)}
                    >
                      Edit
                    </button>
                    <button 
                      className="blog-delete-btn"
                      onClick={() => handleDelete(post._id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </main>
      </div>
      
      <Footer />
    </div>
  );
};

export default BlogPage;
