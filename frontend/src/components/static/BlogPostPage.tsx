import { useParams, Navigate, Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseFrontmatter } from '../../utils/parseFrontmatter';
import Banner from '../Banner';
import Footer from '../Footer';
import './BlogPage.css';

const modules = import.meta.glob('../../content/blog/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function getPost(slug: string) {
  for (const [path, raw] of Object.entries(modules)) {
    const fileSlug = path.split('/').pop()!.replace(/\.md$/, '');
    if (fileSlug === slug) {
      return parseFrontmatter(raw);
    }
  }
  return null;
}

const formatDate = (dateStr: string) =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPost(slug) : null;

  if (!post) return <Navigate to="/blog" replace />;

  return (
    <div className="blog-container">
      <Banner />
      <div className="blog-bg-area">
        <main className="blog-main">
          <Link to="/blog" className="blog-back-link">&larr; Back to blog</Link>

          <article>
            <header className="blog-post-header">
              <h1 className="blog-post-title" style={{ fontSize: '36px' }}>{post.frontmatter.title}</h1>
              <div className="blog-post-meta">
                <span className="blog-post-date">{formatDate(post.frontmatter.date)}</span>
                <span className="blog-post-author">by {post.frontmatter.author}</span>
              </div>
            </header>

            <div className="blog-post-content--markdown">
              <Markdown remarkPlugins={[remarkGfm]}>{post.content}</Markdown>
            </div>
          </article>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default BlogPostPage;
