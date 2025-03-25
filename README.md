# CMR Chat Application

A real-time chat application built with Flask, Socket.IO, and Firebase, featuring both general and private chat capabilities.

## Live Demo
🌐 [CMR Chat App](https://cmr-chat.onrender.com/)

## Features

- 💬 Real-time messaging
- 👤 User authentication
- 🌐 General chat room
- 📱 Private messaging
- 🖼️ Profile picture support
- 🔒 Secure password handling
- ⚡ WebSocket communication

## Test Accounts

Feel free to test the application using these credentials:

| Username | Password |
|----------|----------|
| guest1   | 123456   |
| guest2   | 123456   |
| guest3   | 123456   |

## How to Use

1. Visit [CMR Chat](https://cmr-chat.onrender.com/)
2. Login with test credentials or create your account
3. Upload a profile picture (optional)
4. Join the general chat automatically
5. Click on online users to start private conversations

## Features in Detail

### General Chat
- Public chat room accessible to all logged-in users
- Real-time message updates
- User join/leave notifications

### Private Chat
- One-on-one private conversations
- User online status
- Real-time message delivery

### User Features
- Custom username
- Profile picture upload
- Online status indicator
- Secure authentication

## Technologies Used

- Frontend:
  - HTML5
  - CSS3
  - JavaScript
  - Socket.IO Client
  - Firebase SDK

- Backend:
  - Python
  - Flask
  - Flask-SocketIO
  - Firebase Admin SDK
  - Gunicorn
  - Eventlet

## Local Development

1. Clone the repository
```bash
git clone https://github.com/YourUsername/cmr-chat.git
cd cmr-chat
```

2. Install dependencies
```bash
pip install -r requirements.txt
```

3. Run the application
```bash
python app.py
```

4. Visit `http://localhost:5000` in your browser

## Deployment

This application is deployed on [Render](https://render.com/), a cloud platform for web services.

## Contributing

Feel free to fork the repository and submit pull requests for any improvements.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

For any queries or suggestions, please open an issue in the repository.
