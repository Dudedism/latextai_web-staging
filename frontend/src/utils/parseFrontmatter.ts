export interface BlogFrontmatter {
  title: string;
  date: string;
  author: string;
  excerpt: string;
}

export interface BlogPost {
  slug: string;
  frontmatter: BlogFrontmatter;
  content: string;
}

export function parseFrontmatter(raw: string): { frontmatter: BlogFrontmatter; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: { title: '', date: '', author: '', excerpt: '' }, content: raw };
  }

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    frontmatter[key] = val;
  }

  return {
    frontmatter: frontmatter as unknown as BlogFrontmatter,
    content: match[2],
  };
}
