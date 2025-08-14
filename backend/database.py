from flask_pymongo import PyMongo
from bson import ObjectId
from datetime import datetime

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
            query = {k: v for k, v in self.data.items() if k != '_id'}
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

class User(BaseModel):
    collection_name = 'users'
    
    def __init__(self, email=None, password_hash=None, info=None, **kwargs):
        super().__init__(
            email=email,
            password_hash=password_hash,
            info=info or {},
            created_at=datetime.utcnow(),
            **kwargs
        )

class Answer(BaseModel):
    collection_name = 'answers'
    
    def __init__(self, user_email=None, poll_id=None, question_id=None, answer=None, **kwargs):
        super().__init__(
            user_email=user_email,
            poll_id=poll_id,
            question_id=question_id,
            answer=answer,
            timestamp=datetime.utcnow(),
            **kwargs
        )

class Poll(BaseModel):
    collection_name = 'polls'
    
    def __init__(self, title=None, short_title=None, questions=None, **kwargs):
        super().__init__(
            title=title,
            short_title=short_title,
            questions=questions or [],
            created_at=datetime.utcnow(),
            **kwargs
        )

class PollResponse(BaseModel):
    collection_name = 'poll_responses'
    
    def __init__(self, user_email=None, poll_id=None, responses=None, **kwargs):
        super().__init__(
            user_email=user_email,
            poll_id=poll_id,
            responses=responses or [],
            submitted_at=datetime.utcnow(),
            **kwargs
        )

class Norms(BaseModel):
    collection_name = 'norms'
    
    def __init__(self, name=None, short_title=None, norms=None, **kwargs):
        super().__init__(
            name=name,
            short_title=short_title,
            norms=norms or [],
            created_at=datetime.utcnow(),
            **kwargs
        )

class NormResponses(BaseModel):
    collection_name = 'norm_responses'
    
    def __init__(self, user_email=None, short_title=None, answers=None, **kwargs):
        super().__init__(
            user_email=user_email,
            short_title=short_title,
            answers=answers or [],
            submitted_at=datetime.utcnow(),
            **kwargs
        )