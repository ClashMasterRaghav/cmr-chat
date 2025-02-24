from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import datetime
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key')
socketio = SocketIO(app, cors_allowed_origins="*")

# Get port from environment variable or use default
port = int(os.environ.get('PORT', 5000))

CHAT_HISTORY_FILE = "chat_history.txt"

def save_message(username, message):
    """Save message to chat history file with timestamp"""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(CHAT_HISTORY_FILE, "a") as file:
        file.write(f"[{timestamp}] {username}: {message}\n")

def get_chat_history():
    """Read and return the chat history file"""
    if not os.path.exists(CHAT_HISTORY_FILE):
        return []
    
    with open(CHAT_HISTORY_FILE, "r") as file:
        return file.readlines()

@app.route('/')
def index():
    """Serve the main chat page"""
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    """Handle new connection and send chat history"""
    chat_history = get_chat_history()
    emit('chat_history', {'history': chat_history})
    print("Client connected")

@socketio.on('message')
def handle_message(data):
    """Handle incoming message, save it, and broadcast to all clients"""
    username = data.get('username', 'Anonymous')
    message = data.get('message', '')
    
    if message:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        save_message(username, message)
        
        # Broadcast message to all connected clients
        emit('message', {
            'username': username,
            'message': message,
            'timestamp': timestamp
        }, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=port, debug=False)