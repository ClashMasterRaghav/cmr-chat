from flask import Flask, render_template, request, make_response
from flask_socketio import SocketIO, emit, join_room, leave_room
import datetime
import os
from collections import defaultdict

app = Flask(__name__, 
           template_folder='./',  # Look for templates in current directory
           static_url_path='/static',  # Keep the static URL path
           static_folder='static')  # Keep static files in static folder

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key')
socketio = SocketIO(app, cors_allowed_origins="*")

# Get port from environment variable or use default
port = int(os.environ.get('PORT', 5000))

CHAT_HISTORY_FILE = "chat_history.txt"

# Add these global variables
connected_users = {}
private_messages = defaultdict(list)

def save_message(username, message):
    """Save message to chat history file with timestamp"""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(CHAT_HISTORY_FILE, "a", encoding='utf-8') as file:
            file.write(f"[{timestamp}] {username}: {message}\n")
    except Exception as e:
        print(f"Error saving message: {e}")

def get_chat_history():
    """Read and return the chat history file"""
    try:
        if not os.path.exists(CHAT_HISTORY_FILE):
            return []
        
        with open(CHAT_HISTORY_FILE, "r", encoding='utf-8') as file:
            # Return only the last 100 messages to prevent overload
            lines = file.readlines()
            return lines[-100:] if len(lines) > 100 else lines
    except Exception as e:
        print(f"Error reading chat history: {e}")
        return []

@app.route('/')
def index():
    """Serve the main chat page"""
    try:
        return make_response(render_template('index.html'))
    except Exception as e:
        return make_response(f"Error: {str(e)}", 500)

@socketio.on('connect')
def handle_connect():
    """Handle new connection"""
    print("Client connected")

@socketio.on('user_connect')
def handle_user_connect(data):
    """Handle user connection after authentication"""
    user_id = request.sid
    username = data.get('username')
    profile_pic = data.get('profilePicUrl')
    
    connected_users[user_id] = {
        'username': username,
        'profile_pic': profile_pic
    }
    
    # Send the list of connected users to everyone
    emit('users_list', {'users': list(connected_users.values())}, broadcast=True)
    
    # Send chat history for general chat
    chat_history = get_chat_history()
    emit('chat_history', {'history': chat_history, 'chatType': 'general'})

@socketio.on('private_message')
def handle_private_message(data):
    """Handle private messages between users"""
    sender = data.get('sender')
    recipient = data.get('recipient')
    message = data.get('message')
    timestamp = data.get('timestamp', datetime.datetime.now().isoformat())
    profile_pic_url = data.get('profilePicUrl')
    
    # Create a unique room ID for the private chat
    room_id = create_private_room_id(sender, recipient)
    
    # Store the message
    message_data = {
        'sender': sender,
        'recipient': recipient,
        'message': message,
        'timestamp': timestamp,
        'profilePicUrl': profile_pic_url,
        'room': room_id
    }
    
    private_messages[room_id].append(message_data)
    
    # Find recipient's socket ID
    recipient_sid = None
    for user_id, user_data in connected_users.items():
        if user_data['username'] == recipient:
            recipient_sid = user_id
            break
    
    if recipient_sid:
        # Only emit to the recipient
        emit('private_message', message_data, room=recipient_sid)

@socketio.on('get_private_history')
def handle_get_private_history(data):
    """Get private chat history between two users"""
    user1 = data.get('user1')
    user2 = data.get('user2')
    room_id = create_private_room_id(user1, user2)
    
    # Ensure no duplicate messages in history
    seen_messages = set()
    filtered_history = []
    
    for msg in private_messages[room_id]:
        msg_key = f"{msg['sender']}-{msg['message']}-{msg['timestamp']}"
        if msg_key not in seen_messages:
            filtered_history.append(msg)
            seen_messages.add(msg_key)
    
    emit('private_history', {
        'history': filtered_history,
        'room': room_id
    })

@socketio.on('disconnect')
def handle_disconnect():
    """Handle user disconnection"""
    user_id = request.sid
    if user_id in connected_users:
        username = connected_users[user_id]['username']
        del connected_users[user_id]
        # Notify others that user has disconnected
        emit('user_disconnected', {'username': username}, broadcast=True)
        emit('users_list', {'users': list(connected_users.values())}, broadcast=True)

@socketio.on('message')
def handle_message(data):
    """Handle general chat messages"""
    username = data.get('username')
    message = data.get('message')
    timestamp = data.get('timestamp', datetime.datetime.now().isoformat())
    profile_pic_url = data.get('profilePicUrl')
    
    # Save message to history
    save_message(username, message)
    
    # Broadcast message to all clients except sender
    emit('message', {
        'username': username,
        'message': message,
        'timestamp': timestamp,
        'profilePicUrl': profile_pic_url
    }, broadcast=True, include_self=False)

@socketio.on('get_chat_history')
def handle_get_chat_history():
    """Send chat history to client"""
    chat_history = get_chat_history()
    emit('chat_history', {
        'history': chat_history,
        'chatType': 'general'
    })

@socketio.on('edit_message')
def handle_edit_message(data):
    """Handle message editing"""
    try:
        original_message = data.get('originalMessage')
        new_message = data.get('newMessage')
        timestamp = data.get('timestamp')
        username = data.get('username')
        
        # Update message in chat history file
        update_message_in_history(original_message, new_message, username)
        
        # Broadcast the edit to all clients
        emit('message_edited', {
            'originalMessage': original_message,
            'newMessage': new_message,
            'timestamp': timestamp,
            'username': username
        }, broadcast=True)
        
    except Exception as e:
        print(f"Error editing message: {e}")

def update_message_in_history(original_message, new_message, username):
    """Update a message in the chat history file"""
    try:
        if not os.path.exists(CHAT_HISTORY_FILE):
            return
            
        with open(CHAT_HISTORY_FILE, 'r', encoding='utf-8') as file:
            lines = file.readlines()
            
        with open(CHAT_HISTORY_FILE, 'w', encoding='utf-8') as file:
            for line in lines:
                # Check if this is the line we want to edit
                if f"{username}: {original_message}" in line:
                    # Preserve the timestamp and update the message
                    timestamp = line.split(']')[0] + ']'
                    file.write(f"{timestamp} {username}: {new_message}\n")
                else:
                    file.write(line)
                    
    except Exception as e:
        print(f"Error updating message in history: {e}")

def create_private_room_id(user1, user2):
    """Create a unique room ID for private chats"""
    users = sorted([user1, user2])  # Sort to ensure consistent room IDs
    return f"private_{users[0]}_{users[1]}"

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=port)