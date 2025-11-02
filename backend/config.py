import os
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Load environment variables from .env file
load_dotenv()

# Application URLs
BACKEND_URL = os.getenv('BACKEND_URL')
FRONTEND_URL = os.getenv('FRONTEND_URL')

MONGO_URI = os.getenv('MONGO_URI')
SECRET_KEY = os.getenv('SECRET_KEY')
EMAIL_VERIFICATION_SALT = os.getenv('EMAIL_VERIFICATION_SALT')
MAX_CONTENT_LENGTH = 30 * 1024 * 1024  # 30MB (for DOCX files with many figures)

# Flask-JWT-Extended Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')

# Token expiry: 15 minutes access, 7 days refresh (industry standard)
JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', '900'))  # 15 minutes
JWT_REFRESH_TOKEN_EXPIRES = int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES', '604800'))  # 7 days

ADMIN_IMAGES_DIR = os.getenv('ADMIN_IMAGES_DIR', './images')

# Brevo Email Configuration
BREVO_API_KEY = os.getenv('BREVO_API_KEY')
BREVO_SENDER_EMAIL = os.getenv('BREVO_SENDER_EMAIL')
BREVO_SENDER_NAME = os.getenv('BREVO_SENDER_NAME')
VERIFICATION_BASE_URL = os.getenv('VERIFICATION_BASE_URL')

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')

# LatextAI Microservice Configuration
LATEXTAI_SERVICE_URL = os.getenv('LATEXTAI_SERVICE_URL', 'http://localhost:8001')
LATEXTAI_API_KEY = os.getenv('LATEXTAI_API_KEY')

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["10000 per day", "1000 per hour"]
)