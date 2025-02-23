const fs = require('fs').promises;
const path = require('path');
const marked = require('marked');
const matter = require('gray-matter');

const POSTS_DIR = path.join(__dirname, '..', 'posts');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const TEMPLATE_PATH = path.join(__dirname, 'blog-template.html');

async function generateBlogPost(mdFile) {
    const mdContent = await fs.readFile(path.join(POSTS_DIR, mdFile), 'utf-8');
    const { data, content } = matter(mdContent);
    const htmlContent = marked(content);
    
    const template = await fs.readFile(TEMPLATE_PATH, 'utf-8');
    const date = data.date ? new Date(data.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : '';

    const html = template
        .replace('{{title}}', data.title || 'Untitled')
        .replace('{{date}}', date)
        .replace('{{content}}', htmlContent);

    const outputPath = path.join(PUBLIC_DIR, mdFile.replace('.md', '.html'));
    await fs.writeFile(outputPath, html);
    return { title: data.title, date: date, path: mdFile.replace('.md', '.html') };
}

async function updateBlogIndex(posts) {
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const blogIndexPath = path.join(PUBLIC_DIR, 'writing.html');
    let blogIndexContent = await fs.readFile(blogIndexPath, 'utf-8');
    
    const postsHtml = posts.map(post => 
        `<li><a href="./${post.path}">${post.title}</a> <span class="date">${post.date}</span></li>`
    ).join('\n');
    
    // Replace content between markers
    const startMarker = '<!-- BLOG-LIST-START -->';
    const endMarker = '<!-- BLOG-LIST-END -->';
    const newContent = blogIndexContent.replace(
        new RegExp(`${startMarker}[\\s\\S]*${endMarker}`),
        `${startMarker}\n${postsHtml}\n${endMarker}`
    );
    
    await fs.writeFile(blogIndexPath, newContent);
}

async function main() {
    try {
        // Create posts directory if it doesn't exist
        try {
            await fs.mkdir(POSTS_DIR);
        } catch (err) {
            if (err.code !== 'EEXIST') throw err;
        }

        const files = await fs.readdir(POSTS_DIR);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        
        const posts = [];
        for (const mdFile of mdFiles) {
            const post = await generateBlogPost(mdFile);
            posts.push(post);
        }
        
        await updateBlogIndex(posts);
        console.log('Blog posts generated successfully!');
    } catch (err) {
        console.error('Error generating blog posts:', err);
    }
}

main(); 