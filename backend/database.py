from flask_pymongo import PyMongo
from bson import ObjectId
from datetime import datetime
from werkzeug.security import generate_password_hash

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