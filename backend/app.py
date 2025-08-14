from flask import Flask
from flask_cors import CORS

from api_admin import api_admin
from api_anon import api_anon
from api_auth import api_auth
from api_user import api_user
from config import *
from database import mongo

app = Flask(__name__)

CORS(app)

app.config["MONGO_URI"] = MONGO_URI
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.config['SECRET_KEY'] = SECRET_KEY
app.config['JWT_EXP_DELTA_SECONDS'] = JWT_EXP_DELTA_SECONDS

app.register_blueprint(api_user)
app.register_blueprint(api_anon)
app.register_blueprint(api_admin)
app.register_blueprint(api_auth)

limiter.init_app(app)
mongo.init_app(app)

@app.route('/')
def hello():
    return {'message': 'Hello from Flask LaTeX API!'}

if __name__ == '__main__':
    app.run(debug=True, port=8000)