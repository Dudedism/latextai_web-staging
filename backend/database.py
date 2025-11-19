from flask_pymongo import PyMongo
from bson import ObjectId
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash
import uuid

mongo = PyMongo()

class BaseModel:
    collection_name = None
    
    def __init__(self, **kwargs):
        self.data = kwargs
        
    def save(self):
        if '_id' in self.data:
            result = mongo.db[self.collection_name].update_one(
                {'_id': self.data['_id']}, 
                {'$set': self.data}
            )
            return result.modified_count > 0
        else:
            result = mongo.db[self.collection_name].insert_one(self.data)
            self.data['_id'] = result.inserted_id
            return True
    
    def find(self, query=None):
        if query is None:
            # Only use non-None values for the query
            query = {k: v for k, v in self.data.items() if k != '_id' and v is not None}
        result = mongo.db[self.collection_name].find_one(query)
        if result:
            self.data = result
            return self.data
        return None
    
    @classmethod
    def find_all(cls, query=None):
        if query is None:
            query = {}
        return list(mongo.db[cls.collection_name].find(query))
    
    def delete(self):
        if '_id' in self.data:
            result = mongo.db[self.collection_name].delete_one({'_id': self.data['_id']})
            return result.deleted_count > 0
        return False
    
    def insert(self):
        result = mongo.db[self.collection_name].insert_one(self.data)
        self.data['_id'] = result.inserted_id
        return True

class User(BaseModel):
    collection_name = 'users'

    def __init__(self, name=None, email=None, password=None, is_verified=True, admin=False, data_consent=None, free_upload_used=False, is_deleted=False, **kwargs):
        super().__init__(
            name=name,
            email=email,
            password=password,
            is_verified=is_verified,
            admin=admin,
            data_consent=data_consent,
            free_upload_used=free_upload_used,
            is_deleted=is_deleted,
            created_at=datetime.utcnow(),
            **kwargs
        )
    
    @classmethod
    def find_by_email(cls, email, include_deleted=False):
        """
        Find a user by email address.

        Args:
            email: User email to search for
            include_deleted: If True, includes deleted accounts in search. Default False.

        Returns:
            User document or None
        """
        user = cls()
        query = {'email': email}
        if not include_deleted:
            query['is_deleted'] = {'$ne': True}  # Exclude deleted accounts
        return user.find(query)

    @classmethod
    def find_deleted_by_email(cls, email):
        """Find deleted user accounts by email"""
        return list(mongo.db[cls.collection_name].find({
            'email': email,
            'is_deleted': True
        }))
    
    @classmethod
    def insertdate(cls, email, data):
        result = mongo.db[cls.collection_name].update_one(
            {'email': email}, 
            {'$set': data}
        )
        return result.modified_count > 0
    
    @classmethod
    def update_password(cls, email, password_hash):
        result = mongo.db[cls.collection_name].update_one(
            {'email': email},
            {'$set': {'password': password_hash}}
        )
        return result.modified_count > 0

    @classmethod
    def store_refresh_token(cls, email, refresh_token_jti):
        """
        Store refresh token JTI for a user.
        This enables token rotation and reuse detection.

        Args:
            email: User email
            refresh_token_jti: The JTI (unique identifier) from the refresh token
        """
        result = mongo.db[cls.collection_name].update_one(
            {'email': email},
            {'$set': {'refresh_token_jti': refresh_token_jti, 'token_updated_at': datetime.utcnow()}}
        )
        return result.modified_count > 0

    @classmethod
    def get_refresh_token_jti(cls, email):
        """
        Get the stored refresh token JTI for a user.
        Returns None if no token is stored.
        """
        user = cls.find_by_email(email)
        if user:
            return user.get('refresh_token_jti')
        return None

    @classmethod
    def invalidate_refresh_token(cls, email):
        """
        Invalidate (clear) the refresh token for a user.
        Used when token reuse is detected or user logs out.
        """
        result = mongo.db[cls.collection_name].update_one(
            {'email': email},
            {'$unset': {'refresh_token_jti': '', 'token_updated_at': ''}}
        )
        return result.modified_count > 0

    @classmethod
    def update_data_consent(cls, email, consent):
        """
        Update user's data consent preference.

        Args:
            email: User email
            consent: True (agreed), False (declined), or None (not yet asked)

        Returns:
            True if updated successfully, False otherwise
        """
        result = mongo.db[cls.collection_name].update_one(
            {'email': email},
            {'$set': {'data_consent': consent, 'consent_updated_at': datetime.utcnow()}}
        )
        return result.modified_count > 0

    @classmethod
    def mark_free_upload_used(cls, email):
        """Mark that user has used their free upload"""
        result = mongo.db[cls.collection_name].update_one(
            {'email': email},
            {'$set': {'free_upload_used': True, 'free_upload_used_at': datetime.utcnow()}}
        )
        return result.modified_count > 0

    @classmethod
    def has_used_free_upload(cls, email):
        """Check if user has already used their free upload"""
        user = cls.find_by_email(email)
        return user.get('free_upload_used', False) if user else False

    @classmethod
    def set_upload_lock(cls, email):
        """
        Set upload lock for user to prevent simultaneous uploads.
        Returns True if lock was successfully acquired, False if already locked.
        """
        result = mongo.db[cls.collection_name].update_one(
            {'email': email, 'upload_in_progress': {'$ne': True}},
            {'$set': {'upload_in_progress': True, 'upload_lock_at': datetime.utcnow()}}
        )
        return result.modified_count > 0

    @classmethod
    def release_upload_lock(cls, email):
        """Release upload lock for user"""
        result = mongo.db[cls.collection_name].update_one(
            {'email': email},
            {'$unset': {'upload_in_progress': '', 'upload_lock_at': ''}}
        )
        return result.modified_count > 0

class Project(BaseModel):
    collection_name = 'projects'

    def __init__(self, upload_filename=None, user_id=None, status='unconverted',
                 project_id=None, template=None, paid=False, is_free_project=False,
                 total_cost=0.0, filesize=0, word_count=0, page_count=0,
                 validated=False, **kwargs):
        super().__init__(
            upload_filename=upload_filename,
            user_id=user_id,
            status=status,
            project_id=project_id,
            template=template,
            paid=paid,  # Whether this project has been paid for
            is_free_project=is_free_project,  # Whether this is the user's free project
            total_cost=total_cost,  # Total cost in dollars
            filesize=filesize,  # File size in bytes
            word_count=word_count,  # Number of words in document
            page_count=page_count,  # Number of pages in document
            validated=validated,  # Whether file has been validated (LibreOffice conversion + word count)
            created_at=datetime.utcnow(),
            **kwargs
        )

    @classmethod
    def get_user_identifiers(cls, user):
        """
        Get all possible user identifiers (email and ObjectId) for backwards compatibility.

        Args:
            user: User dict from database

        Returns:
            list: List of possible user_id values [email, str(_id)]
        """
        identifiers = []
        if user.get('email'):
            identifiers.append(user['email'])
        if user.get('_id'):
            identifiers.append(str(user['_id']))
        return identifiers

    @classmethod
    def find_by_user(cls, user):
        """
        Find all projects for a specific user.
        Handles both email and ObjectId formats for backwards compatibility.

        Args:
            user: Either a user dict with 'email' and '_id', or a string (email/user_id)

        Returns:
            list: List of projects owned by the user
        """
        if isinstance(user, str):
            # String passed - query for exact match
            return cls.find_all({'user_id': user})
        else:
            # User dict passed - query for both email and _id
            identifiers = cls.get_user_identifiers(user)
            return cls.find_all({'user_id': {'$in': identifiers}})

    @classmethod
    def delete_by_user(cls, user):
        """
        Delete all projects for a specific user.
        Handles both email and ObjectId formats for backwards compatibility.

        Args:
            user: User dict from database

        Returns:
            int: Number of projects deleted
        """
        identifiers = cls.get_user_identifiers(user)
        result = mongo.db[cls.collection_name].delete_many({'user_id': {'$in': identifiers}})
        return result.deleted_count

    @classmethod
    def transfer_to_user(cls, from_user, to_user):
        """
        Transfer all projects from one user to another.
        Used during account merging.

        Args:
            from_user: Source user dict
            to_user: Target user dict

        Returns:
            int: Number of projects transferred
        """
        from_identifiers = cls.get_user_identifiers(from_user)
        to_email = to_user['email']  # Always use email for new assignments

        result = mongo.db[cls.collection_name].update_many(
            {'user_id': {'$in': from_identifiers}},
            {'$set': {'user_id': to_email}}
        )
        return result.modified_count

    @classmethod
    def find_by_id(cls, project_id):
        """Find a project by its project_id"""
        project = cls()
        return project.find({'project_id': project_id})

    @classmethod
    def delete_with_files(cls, project_id, user_email, user_projects_dir='user_projects'):
        """
        Delete a project and its associated files.

        Args:
            project_id: Project UUID
            user_email: User's email (for file path)
            user_projects_dir: Base directory for user projects

        Returns:
            tuple: (success: bool, message: str)
        """
        import os
        import shutil

        try:
            # Delete files
            project_dir = os.path.join(user_projects_dir, user_email, project_id)
            if os.path.exists(project_dir):
                shutil.rmtree(project_dir, ignore_errors=True)
                print(f"✅ [DELETE] Deleted files for project {project_id}")
            else:
                print(f"⚠️  [DELETE] No files found for project {project_id}")

            # Delete from database
            delete_result = mongo.db[cls.collection_name].delete_one({'project_id': project_id})
            if delete_result.deleted_count > 0:
                print(f"✅ [DELETE] Deleted project {project_id} from database")
                return True, f"Project {project_id} deleted successfully"
            else:
                print(f"⚠️  [DELETE] Project {project_id} not found in database")
                return False, f"Project {project_id} not found in database"

        except Exception as e:
            print(f"❌ [DELETE] Error deleting project {project_id}: {str(e)}")
            return False, f"Error deleting project: {str(e)}"

    def update_status(self, new_status):
        """Update the status of a project"""
        self.data['status'] = new_status
        result = mongo.db[self.collection_name].update_one(
            {'project_id': self.data['project_id']},
            {'$set': {'status': new_status}}
        )
        return result.modified_count > 0

    @classmethod
    def count_user_projects(cls, user):
        """
        Count total number of projects for a user.

        Args:
            user: User dict from database

        Returns:
            int: Total project count
        """
        identifiers = cls.get_user_identifiers(user)
        return mongo.db[cls.collection_name].count_documents({'user_id': {'$in': identifiers}})

    @classmethod
    def has_paid_free_project(cls, user):
        """
        Check if user has at least one project that was both:
        - is_free_project=True (marked as their free project)
        - paid=True (processing was approved/paid for)

        This is used in the freemium model where a user can upload one free file.
        Once that free file is approved for processing (paid=True), they can upload
        more than 10 files for payment.

        Note: This may seem paradoxical (free AND paid), but it makes sense:
        - is_free_project=True means this counted as their "one free upload"
        - paid=True means they approved it for full download/processing

        Args:
            user: User dict from database

        Returns:
            bool: True if user has a paid free project
        """
        identifiers = cls.get_user_identifiers(user)
        count = mongo.db[cls.collection_name].count_documents({
            'user_id': {'$in': identifiers},
            'is_free_project': True,
            'paid': True
        })
        return count > 0

    @classmethod
    def mark_as_paid(cls, project_id, is_free=False, total_cost=0.0):
        """
        Mark a project as paid and optionally as the free project.

        Args:
            project_id: Project ID
            is_free: Whether this is the user's free project
            total_cost: Total cost (0.0 for free projects)

        Returns:
            bool: True if update successful
        """
        result = mongo.db[cls.collection_name].update_one(
            {'project_id': project_id},
            {'$set': {
                'paid': True,
                'is_free_project': is_free,
                'total_cost': total_cost,
                'paid_at': datetime.utcnow(),
                'status': 'validated'  # Ensure status is 'validated' after payment
            }}
        )
        return result.modified_count > 0

class Ticket(BaseModel):
    collection_name = 'tickets'

    def __init__(self, project_id=None, user_id=None, subject=None, status='open',
                 ticket_id=None, messages=None, **kwargs):
        if ticket_id is None:
            ticket_id = str(uuid.uuid4())
        if messages is None:
            messages = []

        super().__init__(
            ticket_id=ticket_id,
            project_id=project_id,
            user_id=user_id,
            subject=subject,
            status=status,
            messages=messages,
            created_at=datetime.utcnow(),
            **kwargs
        )

    @classmethod
    def get_user_identifiers(cls, user):
        """
        Get all possible user identifiers (email and ObjectId) for backwards compatibility.

        Args:
            user: User dict from database

        Returns:
            list: List of possible user_id values [email, str(_id)]
        """
        identifiers = []
        if user.get('email'):
            identifiers.append(user['email'])
        if user.get('_id'):
            identifiers.append(str(user['_id']))
        return identifiers

    @classmethod
    def find_by_id(cls, ticket_id):
        """Find a ticket by its ticket_id"""
        ticket = cls()
        return ticket.find({'ticket_id': ticket_id})

    @classmethod
    def find_by_project(cls, project_id):
        """Get all tickets for a specific project"""
        return cls.find_all({'project_id': project_id})

    @classmethod
    def find_open_ticket_by_project(cls, project_id):
        """Get open ticket for a project (only 1 open at a time)"""
        ticket = cls()
        return ticket.find({'project_id': project_id, 'status': {'$in': ['open', 'in_progress']}})

    @classmethod
    def find_by_user(cls, user):
        """
        Get all tickets created by a user.
        Handles both email and ObjectId formats for backwards compatibility.

        Args:
            user: Either a user dict with 'email' and '_id', or a string (email/user_id)

        Returns:
            list: List of tickets created by the user
        """
        if isinstance(user, str):
            # String passed - query for exact match
            return cls.find_all({'user_id': user})
        else:
            # User dict passed - query for both email and _id
            identifiers = cls.get_user_identifiers(user)
            return cls.find_all({'user_id': {'$in': identifiers}})

    @classmethod
    def delete_by_user(cls, user):
        """
        Delete all tickets for a specific user.
        Handles both email and ObjectId formats for backwards compatibility.

        Args:
            user: User dict from database

        Returns:
            int: Number of tickets deleted
        """
        identifiers = cls.get_user_identifiers(user)
        result = mongo.db[cls.collection_name].delete_many({'user_id': {'$in': identifiers}})
        return result.deleted_count

    @classmethod
    def transfer_to_user(cls, from_user, to_user):
        """
        Transfer all tickets from one user to another.
        Used during account merging.

        Args:
            from_user: Source user dict
            to_user: Target user dict

        Returns:
            int: Number of tickets transferred
        """
        from_identifiers = cls.get_user_identifiers(from_user)
        to_email = to_user['email']  # Always use email for new assignments

        result = mongo.db[cls.collection_name].update_many(
            {'user_id': {'$in': from_identifiers}},
            {'$set': {'user_id': to_email}}
        )
        return result.modified_count

    def add_message(self, content, sender, sender_id):
        """Add a new message to the ticket's messages array"""
        message = {
            'message_id': len(self.data['messages']),
            'content': content,
            'sender': sender,
            'sender_id': sender_id,
            'timestamp': datetime.utcnow()
        }

        # Add message to local data
        self.data['messages'].append(message)

        # Update in database
        result = mongo.db[self.collection_name].update_one(
            {'ticket_id': self.data['ticket_id']},
            {'$push': {'messages': message}}
        )
        return result.modified_count > 0

    def update_status(self, new_status):
        """Change ticket status"""
        self.data['status'] = new_status
        result = mongo.db[self.collection_name].update_one(
            {'ticket_id': self.data['ticket_id']},
            {'$set': {'status': new_status}}
        )
        return result.modified_count > 0

    def count_user_messages_in_last_hour(self):
        """Count messages from user in last 60 minutes (for rate limiting)"""
        if 'messages' not in self.data:
            return 0

        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        count = 0

        for msg in self.data['messages']:
            if msg['sender'] == 'user' and msg.get('timestamp'):
                # Handle both datetime objects and ISO strings
                timestamp = msg['timestamp']
                if isinstance(timestamp, str):
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                if timestamp > one_hour_ago:
                    count += 1

        return count


class UsedToken(BaseModel):
    collection_name = 'used_tokens'

    def __init__(self, token_hash=None, token_type=None, email=None, **kwargs):
        """
        Track used one-time tokens (email verification, password reset).

        Args:
            token_hash: Hash of the token (not the token itself for security)
            token_type: Type of token ('email_verification' or 'password_reset')
            email: Email address associated with the token
        """
        super().__init__(
            token_hash=token_hash,
            token_type=token_type,
            email=email,
            used_at=datetime.utcnow(),
            **kwargs
        )

    @classmethod
    def is_token_used(cls, token_hash):
        """Check if a token has already been used"""
        token = cls()
        return token.find({'token_hash': token_hash}) is not None

    @classmethod
    def mark_token_used(cls, token_hash, token_type, email):
        """Mark a token as used"""
        token = cls(token_hash=token_hash, token_type=token_type, email=email)
        return token.insert()

    @classmethod
    def cleanup_old_tokens(cls, days=7):
        """Remove tokens older than specified days (for maintenance)"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        result = mongo.db[cls.collection_name].delete_many({
            'used_at': {'$lt': cutoff_date}
        })
        return result.deleted_count