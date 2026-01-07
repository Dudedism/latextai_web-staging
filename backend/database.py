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

    def __init__(self, email=None, password=None, is_verified=True, admin=False, data_consent=None, free_project_id=None, is_deleted=False, card_fingerprints=None, credit_balance=0, **kwargs):
        super().__init__(
            email=email,
            password=password,
            is_verified=is_verified,
            admin=admin,
            data_consent=data_consent,
            free_project_id=free_project_id,
            is_deleted=is_deleted,
            card_fingerprints=card_fingerprints if card_fingerprints is not None else [],
            credit_balance=credit_balance,
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
    def update_fields(cls, email, data):
        """Update arbitrary fields for a user by email"""
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
        """Get the stored refresh token JTI for a user. Returns None if no token is stored."""
        result = mongo.db[cls.collection_name].find_one(
            {'email': email, 'is_deleted': {'$ne': True}},
            {'refresh_token_jti': 1}
        )
        return result.get('refresh_token_jti') if result else None

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
    def set_free_project(cls, email, project_id):
        """
        Atomically set the free project for a user.
        Only succeeds if user hasn't already claimed a free project.

        Returns:
            bool: True if successfully set, False if already claimed
        """
        result = mongo.db[cls.collection_name].update_one(
            {'email': email, 'free_project_id': None},
            {'$set': {'free_project_id': project_id, 'free_project_claimed_at': datetime.utcnow()}}
        )
        return result.modified_count > 0

    @classmethod
    def has_claimed_free_project(cls, email):
        """Check if user has already claimed their free project (single-field query)"""
        return mongo.db[cls.collection_name].count_documents(
            {'email': email, 'free_project_id': {'$ne': None}},
            limit=1
        ) > 0

    @classmethod
    def add_card_fingerprint(cls, email, fingerprint):
        """
        Add a card fingerprint to user's array if not already present.

        Returns:
            bool: True if fingerprint was added, False if already exists
        """
        result = mongo.db[cls.collection_name].update_one(
            {'email': email, 'card_fingerprints': {'$ne': fingerprint}},
            {'$addToSet': {'card_fingerprints': fingerprint}}
        )
        return result.modified_count > 0

    @classmethod
    def find_user_with_fingerprint_and_free_claim(cls, fingerprints, exclude_email=None):
        """
        Find any user who has ANY of these fingerprints AND has claimed a free project.
        Used to detect abuse (same card claiming free across multiple accounts).

        Args:
            fingerprints: List of card fingerprints to check
            exclude_email: Email to exclude from search (current user)

        Returns:
            User document if found, None otherwise
        """
        query = {
            'card_fingerprints': {'$in': fingerprints},
            'free_project_id': {'$ne': None}
        }
        if exclude_email:
            query['email'] = {'$ne': exclude_email}
        return mongo.db[cls.collection_name].find_one(query)

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

    @classmethod
    def get_credit_balance(cls, email):
        """Get user's current credit balance"""
        result = mongo.db[cls.collection_name].find_one(
            {'email': email, 'is_deleted': {'$ne': True}},
            {'credit_balance': 1}
        )
        return result.get('credit_balance', 0) if result else 0

    @classmethod
    def add_credits(cls, email, amount):
        """
        Add credits to user's balance atomically.
        Returns new balance or None if user not found.
        """
        result = mongo.db[cls.collection_name].find_one_and_update(
            {'email': email},
            {'$inc': {'credit_balance': amount}},
            return_document=True
        )
        return result.get('credit_balance') if result else None

    @classmethod
    def deduct_credits(cls, email, amount):
        """
        Deduct credits from user's balance atomically.
        Only succeeds if user has sufficient balance.
        Returns new balance or None if insufficient/user not found.
        """
        result = mongo.db[cls.collection_name].find_one_and_update(
            {'email': email, 'credit_balance': {'$gte': amount}},
            {'$inc': {'credit_balance': -amount}},
            return_document=True
        )
        return result.get('credit_balance') if result else None


class Project(BaseModel):
    collection_name = 'projects'

    def __init__(self, upload_filename=None, user_email=None, user_id=None, status='unconverted',
                 project_id=None, template=None, paid=False,
                 total_credits=0, filesize=0, word_count=0, page_count=0,
                 validated=False, feedback=None, **kwargs):
        super().__init__(
            upload_filename=upload_filename,
            user_email=user_email,
            user_id=user_id,
            status=status,
            project_id=project_id,
            template=template,
            paid=paid,
            total_credits=total_credits,
            filesize=filesize,
            word_count=word_count,
            page_count=page_count,
            validated=validated,
            feedback=feedback,
            created_at=datetime.utcnow(),
            **kwargs
        )

    @classmethod
    def find_by_user(cls, user_id):
        """Find all non-orphaned projects for a user by user_id."""
        return cls.find_all({'user_id': user_id, 'is_orphaned': {'$ne': True}})

    @classmethod
    def delete_by_user(cls, user_id):
        """Delete all projects for a user by user_id."""
        result = mongo.db[cls.collection_name].delete_many({'user_id': user_id})
        return result.deleted_count

    @classmethod
    def transfer_to_user(cls, from_user_id, to_user_id, to_user_email):
        """Transfer all projects from one user to another."""
        result = mongo.db[cls.collection_name].update_many(
            {'user_id': from_user_id},
            {'$set': {'user_id': to_user_id, 'user_email': to_user_email}}
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
        Delete a project's files and orphan the database record.
        Keeps user_id for statistics, clears user_email for privacy.

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
            # Delete local files
            project_dir = os.path.join(user_projects_dir, user_email, project_id)
            if os.path.exists(project_dir):
                shutil.rmtree(project_dir, ignore_errors=True)
                print(f"✅ [DELETE] Deleted local files for project {project_id}")
            else:
                print(f"⚠️  [DELETE] No local files found for project {project_id}")

            # Orphan the project in database (keep user_id for stats)
            result = mongo.db[cls.collection_name].update_one(
                {'project_id': project_id},
                {
                    '$set': {
                        'user_email': None,
                        'upload_filename': None,
                        'error_message': None,
                        'is_orphaned': True,
                        'orphaned_at': datetime.utcnow()
                    }
                }
            )

            if result.matched_count > 0:
                print(f"✅ [DELETE] Orphaned project {project_id} in database")
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
    def count_user_projects(cls, user_id):
        """Count total number of non-orphaned projects for a user."""
        return mongo.db[cls.collection_name].count_documents({'user_id': user_id, 'is_orphaned': {'$ne': True}})

    @classmethod
    def has_paid_free_project(cls, user_id):
        """Check if user has any paid project (for upload limit logic)."""
        return mongo.db[cls.collection_name].count_documents(
            {'user_id': user_id, 'paid': True, 'is_orphaned': {'$ne': True}},
            limit=1
        ) > 0

    @classmethod
    def mark_as_paid(cls, project_id, total_cost=0.0):
        """
        Mark a project as paid.

        Args:
            project_id: Project ID
            total_cost: Total cost (0.0 for free projects)

        Returns:
            bool: True if update successful
        """
        result = mongo.db[cls.collection_name].update_one(
            {'project_id': project_id},
            {'$set': {
                'paid': True,
                'total_cost': total_cost,
                'paid_at': datetime.utcnow(),
                'status': 'validated'
            }}
        )
        return result.modified_count > 0

    @classmethod
    def set_feedback(cls, project_id, feedback):
        """
        Set user feedback for a project.

        Args:
            project_id: Project ID
            feedback: 'positive', 'negative', or None to clear

        Returns:
            bool: True if update successful
        """
        result = mongo.db[cls.collection_name].update_one(
            {'project_id': project_id},
            {'$set': {'feedback': feedback, 'feedback_at': datetime.utcnow()}}
        )
        return result.modified_count > 0

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

    @classmethod
    def delete_by_email(cls, email):
        """Delete all tokens for a user (used on account deletion)"""
        result = mongo.db[cls.collection_name].delete_many({'email': email})
        return result.deleted_count


class CreditTransaction(BaseModel):
    collection_name = 'credit_transactions'

    def __init__(self, user_email=None, user_id=None, transaction_type=None, amount=0, balance_after=0,
                 description=None, project_id=None, stripe_session_id=None, **kwargs):
        super().__init__(
            transaction_id=str(uuid.uuid4()),
            user_email=user_email,
            user_id=user_id,
            transaction_type=transaction_type,
            amount=amount,
            balance_after=balance_after,
            description=description,
            project_id=project_id,
            stripe_session_id=stripe_session_id,
            created_at=datetime.utcnow(),
            **kwargs
        )

    @classmethod
    def create(cls, user_email, user_id, transaction_type, amount, balance_after, description,
               project_id=None, stripe_session_id=None):
        """Create and save a new credit transaction"""
        txn = cls(
            user_email=user_email,
            user_id=user_id,
            transaction_type=transaction_type,
            amount=amount,
            balance_after=balance_after,
            description=description,
            project_id=project_id,
            stripe_session_id=stripe_session_id
        )
        txn.insert()
        return txn.data

    @classmethod
    def get_user_transactions(cls, user_id, limit=50):
        """Get recent transactions for a user, newest first"""
        return list(mongo.db[cls.collection_name].find(
            {'user_id': user_id}
        ).sort('created_at', -1).limit(limit))