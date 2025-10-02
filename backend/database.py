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
    
    def __init__(self, name=None, email=None, password=None, is_verified=True, admin=False, **kwargs):
        super().__init__(
            name=name,
            email=email,
            password=password,
            is_verified=is_verified,
            admin=admin,
            created_at=datetime.utcnow(),
            **kwargs
        )
    
    @classmethod
    def find_by_email(cls, email):
        """Find a user by email address only"""
        user = cls()
        return user.find({'email': email})
    
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

class Project(BaseModel):
    collection_name = 'projects'

    def __init__(self, tex_filename=None, upload_filename=None, pdf_filename=None,
                 user_id=None, status='unconverted', project_id=None, template='nature', **kwargs):
        super().__init__(
            tex_filename=tex_filename,
            upload_filename=upload_filename,
            pdf_filename=pdf_filename,
            user_id=user_id,
            status=status,
            project_id=project_id,
            template=template,
            created_at=datetime.utcnow(),
            **kwargs
        )

    @classmethod
    def find_by_user(cls, user_id):
        """Find all projects for a specific user"""
        return cls.find_all({'user_id': user_id})

    @classmethod
    def find_by_id(cls, project_id):
        """Find a project by its project_id"""
        project = cls()
        return project.find({'project_id': project_id})

    def update_status(self, new_status):
        """Update the status of a project"""
        self.data['status'] = new_status
        result = mongo.db[self.collection_name].update_one(
            {'project_id': self.data['project_id']},
            {'$set': {'status': new_status}}
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
    def find_by_user(cls, user_id):
        """Get all tickets created by a user"""
        return cls.find_all({'user_id': user_id})

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