import os
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Load environment variables from .env file
load_dotenv()

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/latext_db')
SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here')
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB

# Flask-JWT-Extended Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', SECRET_KEY)

# Regular users: 15 minutes access, 7 days refresh (industry standard)
JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', '900'))  # 15 minutes
JWT_REFRESH_TOKEN_EXPIRES = int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES', '604800'))  # 7 days

# Anonymous users: 1 hour access, NEVER expires refresh (no password to recover access)
JWT_ANON_ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_ANON_ACCESS_TOKEN_EXPIRES', '3600'))  # 1 hour
JWT_ANON_REFRESH_TOKEN_EXPIRES = False  # Never expires - anonymous users can't log back in!

ADMIN_IMAGES_DIR = os.getenv('ADMIN_IMAGES_DIR', './images')

# SMTP Configuration
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USERNAME = os.getenv('SMTP_USERNAME', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
SMTP_FROM = os.getenv('SMTP_FROM', SMTP_USERNAME)

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["10000 per day", "1000 per hour"]
)