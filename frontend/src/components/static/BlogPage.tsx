import { Link } from 'react-router-dom';
import { parseFrontmatter } from '../../utils/parseFrontmatter';
import type { BlogPost } from '../../utils/parseFrontmatter';
import Banner from '../Banner';
import Footer from '../Footer';
import './BlogPage.css';

const modules = import.meta.glob('../../content/blog/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function loadPosts(): BlogPost[] {
  return Object.entries(modules)
    .map(([path, raw]) => {
      const slug = path.split('/').pop()!.replace(/\.md$/, '');
      const { frontmatter, content } = parseFrontmatter(raw);
      return { slug, frontmatter, content };
    })
    .sort((a, b) => b.frontmatter.date.localeCompare(a.frontmatter.date));
}

const posts = loadPosts();

const formatDate = (dateStr: string) =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const BlogPage: React.FC = () => {
  return (
    <div className="blog-container">
      <Banner />
      <div className="blog-bg-area">
        <main className="blog-main">
          <section className="blog-header">
            <h1 className="blog-title">News & Updates</h1>
            <p className="blog-subtitle">Stay up to date with the latest LaTexT developments</p>
          </section>

          <section className="blog-posts">
            {posts.length === 0 ? (
              <div className="blog-empty">
                <p>No posts yet. Check back soon for updates!</p>
              </div>
            ) : (
              posts.map((post) => (
                <Link to={`/blog/${post.slug}`} key={post.slug} className="blog-post-card">
                  <article className="blog-post">
                    <div className="blog-post-header">
                      <h2 className="blog-post-title">{post.frontmatter.title}</h2>
                      <div className="blog-post-meta">
                        <span className="blog-post-date">{formatDate(post.frontmatter.date)}</span>
                        <span className="blog-post-author">by {post.frontmatter.author}</span>
                      </div>
                    </div>
                    <p className="blog-post-excerpt">{post.frontmatter.excerpt}</p>
                  </article>
                </Link>
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
