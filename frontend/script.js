// Initialize Socket.io connection
const socket = io(window.location.origin, {
    transports: ['websocket', 'polling']
});
const messageInput = document.querySelector('#message-input');
const sendButton = document.querySelector('#send-button');
const chatMessages = document.getElementById('chat-messages');
const usernameInput = document.getElementById('username');
const loginButton = document.getElementById('login-button');
const loginForm = document.getElementById('login-form');
const chatContainer = document.getElementById('chat-container');
const loadingIndicator = document.getElementById('loading-indicator');
const typingIndicator = document.getElementById('typing-indicator');

// Initialize Firebase on the client side
// Replace with your Firebase config
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

// Track current user
let currentUser = null;
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
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
               ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Function to add a message to the chat UI with enhanced styling
function addMessage(data, isHistory = false) {
    // Check if this is a system message
    const isSystemMessage = data.username === 'System';
    
    const messageElement = document.createElement('div');
    const isCurrentUser = currentUser && data.username === currentUser.displayName;
    
    if (isSystemMessage) {
        messageElement.className = 'message system';
    } else {
        messageElement.className = `message ${isCurrentUser ? 'sent' : 'received'}`;
    }
    
    if (!isSystemMessage) {
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
    }
    
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    
    // Check if the message includes URLs and make them clickable
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const messageWithLinks = data.message.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    
    // Check for emoji shortcodes and replace them
    const emojiMap = {
        ':)': '😊', ':D': '😃', ':(': '😞', ':P': '😛', ';)': '😉',
        '<3': '❤️', ':+1:': '👍', ':-1:': '👎', ':fire:': '🔥',
        ':laugh:': '😂', ':smile:': '😊', ':sad:': '😢', ':angry:': '😠',
        ':heart:': '❤️', ':star:': '⭐', ':check:': '✅', ':x:': '❌',
        ':wave:': '👋', ':party:': '🎉', ':think:': '🤔', ':clap:': '👏',
        ':rocket:': '🚀', ':eyes:': '👀', ':100:': '💯', ':ok:': '👌'
    };
    
    let processedMessage = messageWithLinks;
    for (const [code, emoji] of Object.entries(emojiMap)) {
        processedMessage = processedMessage.replace(
            new RegExp(code.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"), 'g'), 
            emoji
        );
    }
    
    contentElement.innerHTML = processedMessage;
    messageElement.appendChild(contentElement);
    
    const timestampElement = document.createElement('div');
    timestampElement.className = 'timestamp';
    timestampElement.textContent = formatTimestamp(data.timestamp);
    messageElement.appendChild(timestampElement);
    
    // Set a data attribute for the message timestamp (useful for read receipts)
    messageElement.dataset.timestamp = data.timestamp;
    
    // Add animation classes for new messages (not history)
    if (!isHistory) {
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(20px)';
    }
    
    chatMessages.appendChild(messageElement);
    
    // Animate message entry if it's a new message
    if (!isHistory) {
        setTimeout(() => {
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
            messageElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            
            // Play notification sound for incoming messages (not from current user)
            if (!isCurrentUser && !isSystemMessage) {
                playNotificationSound();
            }
        }, 10);
    }
    
    // Update read status
    updateReadStatus();
    
    // Scroll to the bottom of the chat
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
        
        const messageData = { 
            username: currentUser.displayName || 'Anonymous', 
            message: message,
            timestamp: new Date().toISOString(),
            profilePicUrl: currentUser.photoURL,
            room: 'general'
        };
        
        socket.emit('message', messageData, (response) => {
            sendButton.disabled = false;
            sendButton.innerHTML = '<span>Send</span><i class="fas fa-paper-plane"></i>';
            
            if (response && response.error) {
                console.error('Error sending message:', response.error);
                alert('Failed to send message. Please try again.');
            } else {
                resetMessageInput();
                clearTimeout(typingTimeout);
                socket.emit('typing', { username: currentUser.displayName, isTyping: false });
            }
        });
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

// Update handleLogin function to include better image handling
function handleLogin() {
    const username = usernameInput.value.trim();
    const password = document.getElementById('password').value;
    
    if (username && password) {
        loginButton.disabled = true;
        loginButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@fakechat.com`;
        
        // Handle profile picture with image compression
        let profilePicUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`;
        
        if (profilePicInput.files.length > 0) {
            const file = profilePicInput.files[0];
            
            // Compress image before upload
            compressImage(file)
                .then(compressedFile => {
                    const storageRef = firebase.storage().ref();
                    const profilePicRef = storageRef.child(`profile-pics/${email}`);
                    
                    return profilePicRef.put(compressedFile);
                })
                .then(snapshot => snapshot.ref.getDownloadURL())
                .then(url => {
                    profilePicUrl = url;
                    proceedWithAuth(email, password, username, profilePicUrl);
                })
                .catch(error => {
                    console.error("Error processing image:", error);
                    proceedWithAuth(email, password, username, profilePicUrl);
                });
        } else {
            proceedWithAuth(email, password, username, profilePicUrl);
        }
    } else {
        alert("Please enter both username and password");
    }
}

// Add image compression function
async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const maxWidth = 800;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(function(blob) {
                    resolve(new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    }));
                }, 'image/jpeg', 0.7); // 70% quality
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

// Add new function to handle authentication
function proceedWithAuth(email, password, username, profilePicUrl) {
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            currentUser = userCredential.user;
            return currentUser.updateProfile({
                displayName: username,
                photoURL: profilePicUrl
            });
        })
        .then(() => {
            completeLogin(username, profilePicUrl);
        })
        .catch((error) => {
            if (error.code === 'auth/user-not-found') {
                auth.createUserWithEmailAndPassword(email, password)
                    .then((userCredential) => {
                        currentUser = userCredential.user;
                        return currentUser.updateProfile({
                            displayName: username,
                            photoURL: profilePicUrl
                        });
                    })
                    .then(() => {
                        completeLogin(username, profilePicUrl);
                    })
                    .catch((error) => {
                        console.error("Error creating account:", error);
                        alert("Error creating account: " + error.message);
                        resetLoginButton();
                    });
            } else {
                console.error("Error signing in:", error);
                alert("Error signing in: " + error.message);
                resetLoginButton();
            }
        });
}

// Update completeLogin function to properly handle loading state
function completeLogin(username, profilePicUrl) {
    loginForm.style.opacity = '0';
    setTimeout(() => {
        loginForm.style.display = 'none';
        chatContainer.style.display = 'flex';
        chatContainer.style.opacity = '0';
        
        setTimeout(() => {
            chatContainer.style.opacity = '1';
            chatContainer.style.transition = 'opacity 0.3s ease';
            // Hide loading indicator after transition
            loadingIndicator.style.display = 'none';
        }, 10);
    }, 300);
    
    // Update user info display
    const userInfoDisplay = document.getElementById('current-username');
    userInfoDisplay.innerHTML = `
        <img src="${profilePicUrl}" alt="${username}" class="profile-pic">
        <span>${username}</span>
    `;
    
    socket.emit('login', { 
        username: username,
        profilePicUrl: profilePicUrl
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
    // Socket event listeners
    socket.on('message', function(data) {
        // Hide loading indicator if visible
        loadingIndicator.style.display = 'none';
        
        addMessage(data);
        
        // Update unread count if window is not focused
        if (!document.hasFocus()) {
            unreadCount++;
            updatePageTitle(unreadCount);
        }
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
        if (event.key === 'Enter') {
            if (event.shiftKey) {
                // Allow new line with Shift+Enter
                return;
            } else {
                // Send message with just Enter
                event.preventDefault();
                sendMessage();
            }
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