from flask import Blueprint, request, jsonify
from datetime import datetime
from bson import ObjectId
from database import mongo
from api_auth import requires_auth

api_blog = Blueprint('api_blog', __name__, url_prefix='/api')

# Authorized blog authors
BLOG_AUTHORS = ['opentypesetter@gmail.com', 'larsbuxmann@gmail.com']

def is_blog_author(email: str) -> bool:
    """Check if user is authorized to write blog posts"""
    return email in BLOG_AUTHORS

# Get all blog posts (public)
@api_blog.route('/blog/posts', methods=['GET'])
def get_posts():
    """Get all blog posts, sorted by date descending"""
    try:
        posts = list(mongo.db.blog_posts.find({}).sort('created_at', -1))
        
        # Convert ObjectId to string for JSON serialization
        for post in posts:
            post['_id'] = str(post['_id'])
            if 'created_at' in post:
                post['created_at'] = post['created_at'].isoformat()
            if 'updated_at' in post:
                post['updated_at'] = post['updated_at'].isoformat()
        
        return jsonify(posts), 200
    except Exception as e:
        print(f"❌ [BLOG] Error fetching posts: {e}")
        return jsonify({'error': 'Failed to fetch posts'}), 500

# Create new blog post (authors only)
@api_blog.route('/blog/posts', methods=['POST'])
@requires_auth
def create_post(user, data):
    """Create a new blog post"""
    if not is_blog_author(user['email']):
        return jsonify({'error': 'Not authorized to create posts'}), 403
    
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()
    
    if not title or not content:
        return jsonify({'error': 'Title and content are required'}), 400
    
    if len(title) > 200:
        return jsonify({'error': 'Title too long (max 200 characters)'}), 400
    
    if len(content) > 50000:
        return jsonify({'error': 'Content too long (max 50000 characters)'}), 400
    
    try:
        post = {
            'title': title,
            'content': content,
            'author_email': user['email'],
            'author_name': user.get('name', user['email'].split('@')[0]),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = mongo.db.blog_posts.insert_one(post)
        post['_id'] = str(result.inserted_id)
        post['created_at'] = post['created_at'].isoformat()
        post['updated_at'] = post['updated_at'].isoformat()
        
        print(f"✅ [BLOG] New post created by {user['email']}: {title}")
        return jsonify(post), 201
    except Exception as e:
        print(f"❌ [BLOG] Error creating post: {e}")
        return jsonify({'error': 'Failed to create post'}), 500

# Update blog post (authors only)
@api_blog.route('/blog/posts/<post_id>', methods=['PUT'])
@requires_auth
def update_post(user, data, post_id):
    """Update an existing blog post"""
    if not is_blog_author(user['email']):
        return jsonify({'error': 'Not authorized to update posts'}), 403
    
    try:
        post = mongo.db.blog_posts.find_one({'_id': ObjectId(post_id)})
        if not post:
            return jsonify({'error': 'Post not found'}), 404
        
        title = data.get('title', post['title']).strip()
        content = data.get('content', post['content']).strip()
        
        if len(title) > 200:
            return jsonify({'error': 'Title too long (max 200 characters)'}), 400
        
        if len(content) > 50000:
            return jsonify({'error': 'Content too long (max 50000 characters)'}), 400
        
        mongo.db.blog_posts.update_one(
            {'_id': ObjectId(post_id)},
            {'$set': {
                'title': title,
                'content': content,
                'updated_at': datetime.utcnow()
            }}
        )
        
        print(f"✅ [BLOG] Post updated by {user['email']}: {title}")
        return jsonify({'message': 'Post updated'}), 200
    except Exception as e:
        print(f"❌ [BLOG] Error updating post: {e}")
        return jsonify({'error': 'Failed to update post'}), 500

# Delete blog post (authors only)
@api_blog.route('/blog/posts/<post_id>', methods=['DELETE'])
@requires_auth
def delete_post(user, post_id):
    """Delete a blog post"""
    if not is_blog_author(user['email']):
        return jsonify({'error': 'Not authorized to delete posts'}), 403
    
    try:
        result = mongo.db.blog_posts.delete_one({'_id': ObjectId(post_id)})
        if result.deleted_count == 0:
            return jsonify({'error': 'Post not found'}), 404
        
        print(f"✅ [BLOG] Post deleted by {user['email']}: {post_id}")
        return jsonify({'message': 'Post deleted'}), 200
    except Exception as e:
        print(f"❌ [BLOG] Error deleting post: {e}")
        return jsonify({'error': 'Failed to delete post'}), 500

# Check if current user can author posts
@api_blog.route('/blog/can-author', methods=['GET'])
@requires_auth
def can_author(user):
    """Check if the current user is authorized to write blog posts"""
    return jsonify({'can_author': is_blog_author(user['email'])}), 200
