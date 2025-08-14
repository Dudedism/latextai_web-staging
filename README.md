# LaTeX Survey API Project

A Flask-based backend API with React frontend for managing surveys, polls, and norms data.

## Project Structure

```
latext-site/
├── backend/                    # Flask API server
│   ├── app.py                 # Main Flask application
│   ├── config.py              # Configuration and settings
│   ├── database.py            # MongoDB models and database layer
│   ├── api_auth.py            # Authentication blueprint (login, register, JWT)
│   ├── api_user.py            # User operations blueprint (profile, responses)
│   ├── api_admin.py           # Admin operations blueprint (manage polls, users)
│   ├── api_anon.py            # Anonymous/public endpoints blueprint
│   ├── requirements.txt       # Python dependencies
│   └── venv/                  # Virtual environment
├── frontend/                  # React + Vite frontend
│   ├── src/                   # React source code
│   ├── public/                # Static assets
│   ├── package.json           # Node.js dependencies
│   └── node_modules/          # Installed packages
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

## Backend Architecture

### Blueprints Organization

The Flask backend is organized using blueprints to separate different functionalities:

- **`api_auth`** (`/api/auth/*`): Authentication endpoints
  - `POST /api/auth/register` - User registration
  - `POST /api/auth/login` - User login
  - `GET /api/auth/verify` - Token verification

- **`api_user`** (`/api/user/*`): User-specific operations (requires authentication)
  - `GET /api/user/profile` - Get user profile
  - `PUT /api/user/profile` - Update user profile
  - `GET /api/user/polls` - Get user's poll responses
  - `POST /api/user/polls/<poll_id>/submit` - Submit poll response
  - `POST /api/user/norms/<short_title>/submit` - Submit norm response
  - `GET /api/user/answers` - Get user's answers

- **`api_admin`** (`/api/admin/*`): Admin operations (requires admin authentication)
  - `GET /api/admin/users` - List all users
  - `DELETE /api/admin/users/<email>` - Delete user
  - `GET /api/admin/polls` - List all polls
  - `POST /api/admin/polls` - Create new poll
  - `PUT /api/admin/polls/<id>` - Update poll
  - `DELETE /api/admin/polls/<id>` - Delete poll
  - `GET /api/admin/norms` - List all norms
  - `POST /api/admin/norms` - Create new norm
  - `GET /api/admin/stats` - Get system statistics

- **`api_anon`** (`/api/*`): Public endpoints (no authentication required)
  - `GET /api/health` - Health check
  - `GET /api/polls/public` - List public polls
  - `GET /api/polls/<id>/details` - Get poll details
  - `GET /api/norms/public` - List public norms
  - `GET /api/norms/<title>/details` - Get norm details
  - `GET /api/info` - App information

### Database Models

MongoDB collections managed through custom base model:

- **Users**: User accounts with email, password hash, and profile info
- **Polls**: Survey polls with questions and metadata
- **PollResponse**: User responses to polls
- **Norms**: Normative data structures
- **NormResponses**: User responses to norm assessments
- **Answer**: Individual question answers

### Security Features

- JWT-based authentication
- Password hashing with SHA-256
- Rate limiting on sensitive endpoints
- CORS support for frontend integration
- Admin role validation

## Setup Instructions

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Create and activate virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables (optional):
   ```bash
   export MONGO_URI="mongodb://localhost:27017/latext_db"
   export SECRET_KEY="your-secret-key-here"
   ```

5. Run the Flask server:
   ```bash
   python app.py
   ```
   Server runs on `http://localhost:8000`

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run development server:
   ```bash
   npm run dev
   ```
   Development server runs on `http://localhost:5173`

## Dependencies

### Backend (Python)
- **Flask**: Web framework
- **Flask-CORS**: Cross-origin resource sharing
- **Flask-PyMongo**: MongoDB integration
- **Flask-Limiter**: Rate limiting
- **PyJWT**: JWT token handling
- **python-dotenv**: Environment variable management

### Frontend (Node.js)
- **React**: UI framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool and dev server

## Development Notes

- MongoDB is required for the backend to function properly
- Admin users are identified by email domain (`@admin.com`)
- JWT tokens expire based on `JWT_EXP_DELTA_SECONDS` configuration
- Rate limiting is applied to prevent abuse
- All API responses follow JSON format
- CORS is enabled for frontend-backend communication

## API Authentication

Most endpoints require JWT authentication via `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

Admin endpoints additionally require admin role validation.

## Environment Configuration

Key environment variables:
- `MONGO_URI`: MongoDB connection string
- `SECRET_KEY`: JWT signing secret
- `JWT_EXP_DELTA_SECONDS`: Token expiration time
- `ADMIN_IMAGES_DIR`: Admin images directory path