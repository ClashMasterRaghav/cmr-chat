// Initialize Socket.io connection
const socket = io({
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAKHigQBGZVHFnDBHJqwirQ9-9zcsXsH8Q",
    authDomain: "cmr-chats.firebaseapp.com",
    projectId: "cmr-chats",
    storageBucket: "cmr-chats.firebasestorage.app",
    messagingSenderId: "1053212169224",
    appId: "1:1053212169224:web:ecb5d10ad09aebd96f6dbd",
    measurementId: "G-G7MYZQG8H7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentUser = null;
let currentChatType = 'general';
let currentChatPartner = null;
let connected_users = {};

// DOM Elements
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const chatMessages = document.getElementById('chat-messages');
const usernameInput = document.getElementById('username');
const loginButton = document.getElementById('login-button');
const loginForm = document.getElementById('login-form');
const chatContainer = document.getElementById('chat-container');
const loadingIndicator = document.getElementById('loading-indicator');
const typingIndicator = document.getElementById('typing-indicator');
const currentUsernameDisplay = document.getElementById('current-username');

// Track current user
let typingTimeout = null;
let lastReadTimestamp = null;
let unreadCount = 0;

// Function to play notification sound
function playNotificationSound() {
    const audio = new Audio();
    audio.src = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAoAAAyQAAPDxcXISElJSsrMzM3Nzs7QUFHR0tLUVFXV1tbYWFnZ2trcXF3d3t7QUFHR01NVVVdXWVlaWlxcXl5QUFJSVFRWVlhYWlpcXF5eUFBSUlRUVlZYWFpaXFxeXlBQUlJUVFZWWFhaWlxcXl5QQ==';
    audio.volume = 0.5;
    audio.play().catch(e => console.log('Error playing notification sound', e));
}

// Function to format timestamp
function formatTimestamp(timestamp) {
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        
        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    } catch (e) {
        console.error('Error formatting timestamp:', e);
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Function to add a message to the chat UI with enhanced styling
function addMessage(data, isHistory = false) {
    const messageElement = document.createElement('div');
    const isCurrentUser = currentUser && data.username === currentUser.displayName;
    
    messageElement.className = `message ${isCurrentUser ? 'sent' : 'received'}`;
    
    const userInfoElement = document.createElement('div');
    userInfoElement.className = 'message-user-info';
    
    // Add profile picture
    const profilePic = document.createElement('img');
    profilePic.src = data.profilePicUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.username)}`;
    profilePic.alt = data.username;
    profilePic.className = 'message-profile-pic';
    userInfoElement.appendChild(profilePic);
    
    const usernameElement = document.createElement('div');
    usernameElement.className = 'username';
    usernameElement.textContent = data.username;
    userInfoElement.appendChild(usernameElement);
    
    messageElement.appendChild(userInfoElement);
    
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    contentElement.textContent = data.message;
    messageElement.appendChild(contentElement);
    
    const timestampElement = document.createElement('div');
    timestampElement.className = 'timestamp';
    timestampElement.textContent = formatTimestamp(data.timestamp);
    messageElement.appendChild(timestampElement);
    
    // Add message actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';
    
    // Only show edit/delete for user's own messages
    if (isCurrentUser) {
        actionsDiv.innerHTML = `
            <button class="message-action-btn" title="Edit">
                <i class="fas fa-edit"></i>
            </button>
            <button class="message-action-btn" title="Delete">
                <i class="fas fa-trash"></i>
            </button>
        `;
    }
    
    actionsDiv.innerHTML += `
        <button class="message-action-btn" title="Reply">
            <i class="fas fa-reply"></i>
        </button>
        <button class="message-action-btn" title="React">
            <i class="fas fa-smile"></i>
        </button>
    `;
    
    messageElement.appendChild(actionsDiv);
    
    // Add event listeners for actions
    actionsDiv.querySelectorAll('.message-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.title.toLowerCase();
            switch(action) {
                case 'edit':
                    if (isCurrentUser) {
                        const newMessage = prompt('Edit your message:', data.message);
                        if (newMessage && newMessage !== data.message) {
                            // Emit edit event to server
                            socket.emit('edit_message', {
                                originalMessage: data.message,
                                newMessage: newMessage,
                                timestamp: data.timestamp,
                                username: currentUser.displayName
                            });
                            
                            // Update UI
                            contentElement.textContent = newMessage;
                            data.message = newMessage; // Update the data object
                        }
                    }
                    break;
                case 'delete':
                    if (isCurrentUser && confirm('Are you sure you want to delete this message?')) {
                        messageElement.remove();
                        // Here you would typically emit a socket event to delete the message
                    }
                    break;
                case 'reply':
                    messageInput.value = `@${data.username} `;
                    messageInput.focus();
                    break;
                case 'react':
                    alert('Reaction feature coming soon!');
                    break;
            }
        });
    });
    
    chatMessages.appendChild(messageElement);
    scrollToBottom();
}

// Function to scroll to bottom of chat, with smooth scrolling
function scrollToBottom() {
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: 'smooth'
    });
}

// Update the title with unread count
function updatePageTitle(count) {
    if (count > 0) {
        document.title = `(${count}) Firebase Chat App`;
    } else {
        document.title = 'Firebase Chat App';
    }
}

// Update read status when window is focused or messages are visible
function updateReadStatus() {
    if (document.hasFocus() && isElementInViewport(chatMessages)) {
        unreadCount = 0;
        updatePageTitle(0);
        
        // Update last read timestamp
        const messages = chatMessages.querySelectorAll('.message');
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            lastReadTimestamp = lastMessage.dataset.timestamp;
        }
    }
}

// Check if element is visible in viewport
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Function to send a message with error handling and UI feedback
function sendMessage() {
    const message = messageInput.value.trim();
    
    if (message && currentUser) {
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        const timestamp = new Date().toISOString();
        
        if (currentChatType === 'private' && currentChatPartner) {
            const messageData = {
                sender: currentUser.displayName,
                recipient: currentChatPartner,
                message: message,
                timestamp: timestamp,
                profilePicUrl: currentUser.photoURL
            };
            
            // Send private message
            socket.emit('private_message', messageData);
            
            // Add message locally for sender immediately
            addMessage({
                username: currentUser.displayName,
                message: message,
                timestamp: timestamp,
                profilePicUrl: currentUser.photoURL
            });
        } else {
            // Send general message
            const messageData = {
                username: currentUser.displayName,
                message: message,
                timestamp: timestamp,
                profilePicUrl: currentUser.photoURL
            };
            socket.emit('message', messageData);
            addMessage(messageData);
        }
        
        resetMessageInput();
        sendButton.disabled = false;
        sendButton.innerHTML = '<span>Send</span><i class="fas fa-paper-plane"></i>';
    }
}

// Typing indicator functionality
function handleTyping() {
    if (currentUser) {
        clearTimeout(typingTimeout);
        
        socket.emit('typing', { 
            username: currentUser.displayName, 
            isTyping: true 
        });
        
        typingTimeout = setTimeout(() => {
            socket.emit('typing', { 
                username: currentUser.displayName, 
                isTyping: false 
            });
        }, 2000);
    }
}

// Add this near the top of the file after the DOM element declarations
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    handleLogin();
});

// Add this after your DOM element declarations
const profilePicInput = document.getElementById('profile-pic');
const profilePicPreview = document.getElementById('profile-pic-preview');
const profilePicLabel = document.getElementById('profile-pic-label');

// Add profile picture preview functionality
profilePicInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('Please choose an image under 5MB');
            profilePicInput.value = '';
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            alert('Please choose an image file');
            profilePicInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            profilePicPreview.style.backgroundImage = `url(${e.target.result})`;
            profilePicPreview.classList.add('has-image');
            profilePicLabel.textContent = file.name;
        };
        reader.readAsDataURL(file);
    }
});

// Handle Login
async function handleLogin() {
    const username = usernameInput.value.trim();
    const password = document.getElementById('password').value;
    
    if (username && password) {
        loginButton.disabled = true;
        loginButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@fakechat.com`;
            let userCredential;
            
            try {
                // Try to sign in
                userCredential = await auth.signInWithEmailAndPassword(email, password);
            } catch (error) {
                if (error.code === 'auth/user-not-found') {
                    // If user doesn't exist, create account
                    userCredential = await auth.createUserWithEmailAndPassword(email, password);
                } else {
                    throw error;
                }
            }
            
            currentUser = userCredential.user;
            await currentUser.updateProfile({
                displayName: username
            });
            
            completeLogin(username);
            
        } catch (error) {
            console.error("Error signing in:", error);
            alert("Error signing in: " + error.message);
            loginButton.disabled = false;
            loginButton.innerHTML = '<span>Login</span><i class="fas fa-sign-in-alt"></i>';
        }
    } else {
        alert("Please enter both username and password");
    }
}

// Complete login process
function completeLogin(username) {
    loginForm.style.display = 'none';
    chatContainer.style.display = 'flex';
    
    // Update user info display
    currentUsernameDisplay.textContent = username;
    
    // Initialize with general chat
    currentChatType = 'general';
    updateCurrentChatInfo('general');
    
    socket.emit('user_connect', {
        username: username,
        profilePicUrl: currentUser.photoURL
    });
    
    setupMessageListeners();
}

// Add logout functionality
document.addEventListener('DOMContentLoaded', function() {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            // Confirm logout
            if (confirm('Are you sure you want to logout?')) {
                // Show loading state
                logoutButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                
                // Sign out from Firebase
                auth.signOut()
                    .then(() => {
                        // Smooth transition
                        chatContainer.style.opacity = '0';
                        
                        setTimeout(() => {
                            // Hide chat and show login form
                            chatContainer.style.display = 'none';
                            loginForm.style.display = 'flex';
                            loginForm.style.opacity = '0';
                            
                            setTimeout(() => {
                                loginForm.style.opacity = '1';
                                loginForm.style.transition = 'opacity 0.3s ease';
                            }, 10);
                            
                            // Clear chat messages
                            chatMessages.innerHTML = '';
                            
                            // Reset login button
                            loginButton.innerHTML = '<span>Login</span><i class="fas fa-sign-in-alt"></i>';
                            loginButton.disabled = false;
                            
                            console.log("User signed out");
                        }, 300);
                    })
                    .catch((error) => {
                        // Reset logout button
                        logoutButton.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>Logout</span>';
                        
                        console.error("Error signing out:", error);
                        alert("Error signing out: " + error.message);
                    });
            }
        });
    }
});

function setupMessageListeners() {
    const generalChatBtn = document.getElementById('general-chat-btn');
    if (generalChatBtn) {
        generalChatBtn.addEventListener('click', function(e) {
            e.preventDefault();
            switchToGeneralChat();
        });
    }

    socket.on('message', function(data) {
        console.log('Received general message:', data);
        if (currentChatType === 'general') {
            addMessage(data);
            
            // Show notification and highlight user if message is from someone else
            if (data.username !== currentUser.displayName) {
                showNotification(`New message from ${data.username}`);
                playNotificationSound();
                highlightUserItem(data.username);
            }
        }
    });

    socket.on('private_message', function(data) {
        if (currentChatType === 'private') {
            const otherUser = data.sender === currentUser.displayName ? data.recipient : data.sender;
            if (otherUser === currentChatPartner) {
                // Only add if not already in the chat
                const existingMessages = Array.from(chatMessages.children);
                const isDuplicate = existingMessages.some(msg => {
                    const content = msg.querySelector('.message-content').textContent;
                    const time = msg.querySelector('.timestamp').textContent;
                    return content === data.message && 
                           Math.abs(new Date(data.timestamp) - new Date(time)) < 1000;
                });

                if (!isDuplicate) {
                    addMessage({
                        username: data.sender,
                        message: data.message,
                        timestamp: data.timestamp,
                        profilePicUrl: data.profilePicUrl
                    });
                }
            } else {
                // Highlight user item if message is from someone else
                if (data.sender !== currentUser.displayName) {
                    highlightUserItem(data.sender);
                }
            }
        } else {
            // If not in private chat with sender, highlight their user item
            if (data.sender !== currentUser.displayName) {
                highlightUserItem(data.sender);
            }
        }
        
        // Show notification if chat is not focused or if in different chat
        if ((!document.hasFocus() || data.sender !== currentChatPartner) && 
            data.sender !== currentUser.displayName) {
            showNotification(`New message from ${data.sender}`);
            playNotificationSound();
        }
    });

    socket.on('users_list', function(data) {
        connected_users = data.users;
        updateUsersList(data.users);
    });

    socket.on('chat_history', function(data) {
        console.log('Received chat history:', data);
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = '';
        
        if (Array.isArray(data.history)) {
            data.history.forEach(msg => {
                try {
                    const match = msg.match(/\[(.*?)\] (.*?): (.*)/);
                    if (match) {
                        const [, timestamp, username, message] = match;
                        addMessage({
                            username: username,
                            message: message.trim(),
                            timestamp: new Date(timestamp).toISOString(),
                            profilePicUrl: connected_users[username]?.profilePicUrl
                        }, true);
                    }
                } catch (e) {
                    console.error('Error parsing message:', e);
                }
            });
        }
        scrollToBottom();
    });

    socket.on('private_history', function(data) {
        chatMessages.innerHTML = '';
        const processedMessages = new Set();
        
        data.history.forEach(msg => {
            const messageKey = `${msg.sender}-${msg.message}-${msg.timestamp}`;
            if (!processedMessages.has(messageKey)) {
                addMessage({
                    username: msg.sender,
                    message: msg.message,
                    timestamp: msg.timestamp,
                    profilePicUrl: msg.profilePicUrl
                }, true);
                processedMessages.add(messageKey);
            }
        });
        scrollToBottom();
    });

    // Listen for typing events
    socket.on('typing', function(data) {
        if (data.username !== currentUser.displayName) {
            if (data.isTyping) {
                typingIndicator.style.display = 'flex';
                typingIndicator.textContent = `${data.username} is typing...`;
            } else {
                typingIndicator.style.display = 'none';
            }
        }
    });

    // Listen for user joined/left events
    socket.on('user_joined', function(data) {
        addMessage({
            username: 'System',
            message: `${data.username} joined the chat`,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('user_left', function(data) {
        addMessage({
            username: 'System',
            message: `${data.username} left the chat`,
            timestamp: new Date().toISOString()
        });
    });

    // Listen for connection/disconnection events
    socket.on('connect', function() {
        console.log('Connected to server');
        addMessage({
            username: 'System',
            message: 'Connected to chat server',
            timestamp: new Date().toISOString()
        });
    });

    socket.on('disconnect', function() {
        console.log('Disconnected from server');
        addMessage({
            username: 'System',
            message: 'Disconnected from chat server. Trying to reconnect...',
            timestamp: new Date().toISOString()
        });
    });

    // Set up input event listeners
    messageInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    messageInput.addEventListener('input', handleTyping);
    sendButton.addEventListener('click', sendMessage);

    // Set up window focus events for unread count
    window.addEventListener('focus', updateReadStatus);
    window.addEventListener('blur', function() {
        // Reset unread count when window loses focus
        unreadCount = 0;
    });

    // Add new listeners for private chat
    socket.on('private_message', function(data) {
        if (currentChatType === 'private' && 
            (data.sender === currentChatPartner || data.sender === currentUser.displayName)) {
            addMessage({
                username: data.sender,
                message: data.message,
                timestamp: data.timestamp,
                profilePicUrl: Object.values(connected_users).find(u => u.username === data.sender)?.profile_pic
            });
        }
        
        // Show notification if chat is not focused
        if (!document.hasFocus() && data.sender !== currentUser.displayName) {
            // You can add desktop notification here
            playNotificationSound();
        }
    });

    socket.on('users_list', function(data) {
        updateUsersList(data.users);
    });

    // Add this socket listener with your other socket events
    socket.on('message_edited', function(data) {
        // Find and update the edited message
        const messages = document.querySelectorAll('.message');
        messages.forEach(messageEl => {
            const content = messageEl.querySelector('.message-content');
            const timestamp = messageEl.querySelector('.timestamp');
            const username = messageEl.querySelector('.username');
            
            // Match message by content, timestamp and username to ensure we update the correct one
            if (content.textContent === data.originalMessage && 
                username.textContent === data.username) {
                content.textContent = data.newMessage;
                // Add a subtle animation to show the message was edited
                content.classList.add('message-edited');
                setTimeout(() => content.classList.remove('message-edited'), 1000);
            }
        });
    });
}

// Auto-resize functionality for the textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    const newHeight = Math.min(this.scrollHeight, 150); // Max height of 150px
    this.style.height = newHeight + 'px';
    handleTyping();
});

// Reset textarea height when message is sent
function resetMessageInput() {
    messageInput.value = '';
    messageInput.style.height = 'auto';
    messageInput.focus();
}

// Add emoji button and picker (optional)
const emojiButton = document.createElement('button');
emojiButton.innerHTML = '😊';
emojiButton.className = 'emoji-button';
emojiButton.title = 'Available emoji shortcuts:\n' + 
    Object.entries(emojiMap).map(([code, emoji]) => `${code} = ${emoji}`).join('\n');

// Insert emoji button before send button
sendButton.parentNode.insertBefore(emojiButton, sendButton);

// Show emoji shortcuts on click
emojiButton.addEventListener('click', function() {
    alert('Available emoji shortcuts:\n' + 
        Object.entries(emojiMap).map(([code, emoji]) => `${code} = ${emoji}`).join('\n'));
});

function updateCurrentChatInfo(chatType, partner = null) {
    const chatInfoDiv = document.getElementById('current-chat-info');
    if (chatType === 'general') {
        chatInfoDiv.innerHTML = `
            <div class="chat-details">
                <h3>General Chat</h3>
                <small>Public chat room for all users</small>
            </div>
        `;
    } else {
        const partnerInfo = Object.values(connected_users).find(u => u.username === partner);
        chatInfoDiv.innerHTML = `
            <img src="${partnerInfo?.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(partner)}`}" alt="${partner}">
            <div class="chat-details">
                <h3>${partner}</h3>
                <small>Private chat</small>
            </div>
        `;
    }
}

function updateUsersList(users) {
    const usersList = document.getElementById('online-users-list');
    usersList.innerHTML = '';
    
    users.forEach(user => {
        if (user.username !== currentUser.displayName) {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            if (currentChatPartner === user.username) {
                userItem.classList.add('active');
            }
            
            userItem.innerHTML = `
                <img src="${user.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}`}" 
                     alt="${user.username}">
                <span>${user.username}</span>
                <span class="user-status"></span>
            `;
            
            userItem.addEventListener('click', () => {
                startPrivateChat(user.username);
            });
            
            usersList.appendChild(userItem);
        }
    });
}

function startPrivateChat(username) {
    // Clear current chat
    chatMessages.innerHTML = '';
    currentChatType = 'private';
    currentChatPartner = username;
    
    // Remove highlight when starting chat
    removeUserHighlight(username);
    
    // Update UI
    updateCurrentChatInfo('private', username);
    document.querySelectorAll('.chat-option').forEach(opt => opt.classList.remove('active'));
    document.querySelectorAll('.user-item').forEach(item => {
        if (item.querySelector('span').textContent === username) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Get chat history
    socket.emit('get_private_history', {
        user1: currentUser.displayName,
        user2: username
    });
}

function switchToGeneralChat() {
    // Clear current chat
    chatMessages.innerHTML = '';
    
    // Update state
    currentChatType = 'general';
    currentChatPartner = null;
    
    // Remove all user highlights when switching to general chat
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
        item.classList.remove('new-message');
    });
    
    const generalChatBtn = document.getElementById('general-chat-btn');
    if (generalChatBtn) {
        generalChatBtn.classList.add('active');
    }
    
    // Update chat info
    updateCurrentChatInfo('general');
    
    // Get general chat history
    socket.emit('get_chat_history');
}

// Add this function near the top with other utility functions
function showNotification(message) {
    // Flash the chat container
    const chatContainer = document.querySelector('.chat-container');
    chatContainer.classList.add('notification-flash');
    
    // Update page title with notification
    const originalTitle = document.title;
    document.title = '🔔 New Message - Chat App';
    
    // Remove flash effect after animation completes
    setTimeout(() => {
        chatContainer.classList.remove('notification-flash');
    }, 1000);
    
    // Reset title when window is focused
    window.addEventListener('focus', function onFocus() {
        document.title = originalTitle;
        window.removeEventListener('focus', onFocus);
    });
}

// Add mobile sidebar toggle functionality
function setupMobileSidebar() {
    const sidebar = document.querySelector('.chat-sidebar');
    const toggle = document.createElement('div');
    toggle.className = 'sidebar-toggle';
    toggle.innerHTML = '<i class="fas fa-bars"></i>';
    sidebar.appendChild(toggle);

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
    });
}

// Initialize UI improvements
document.addEventListener('DOMContentLoaded', () => {
    setupMobileSidebar();
    
    // Add button feedback to all buttons
    document.querySelectorAll('button').forEach(btn => {
        btn.classList.add('button-feedback');
    });
});

// Add this function to handle user item highlighting
function highlightUserItem(username) {
    const usersList = document.getElementById('online-users-list');
    const userItems = usersList.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const itemUsername = item.querySelector('span').textContent;
        if (itemUsername === username && username !== currentChatPartner) {
            item.classList.add('new-message');
        }
    });
}

// Remove highlight when starting chat with user
function removeUserHighlight(username) {
    const usersList = document.getElementById('online-users-list');
    const userItems = usersList.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const itemUsername = item.querySelector('span').textContent;
        if (itemUsername === username) {
            item.classList.remove('new-message');
        }
    });
}