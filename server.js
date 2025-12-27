const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Filter = require('bad-words'); 
const helmet = require('helmet'); // NEW: Security Headers
const rateLimit = require('express-rate-limit'); // NEW: Anti-Spam
const xss = require('xss'); // NEW: Anti-Hacking

const filter = new Filter(); 
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // In production, replace "*" with your actual domain
        methods: ["GET", "POST"]
    }
});

// --- SECURITY MIDDLEWARE ---

// 1. Helmet: Hides "X-Powered-By: Express" and sets security headers
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts/styles for this simple app
}));

// 2. Rate Limiter: Relaxed for development
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // Reset count every 1 minute (instead of 15)
    max: 5000, // Allow 5000 requests per minute (instead of 100)
    message: "Too many requests from this IP, please try again later."
});
app.use(limiter);

// ---------------------------

app.use(express.static(path.join(__dirname, 'public')));

let waitingQueue = [];

io.on('connection', (socket) => {
    // Limit sockets: If server is full, disconnect (Optional protection)
    if (io.sockets.sockets.size > 5000) {
        socket.disconnect();
        return;
    }

    io.emit('user_count', io.sockets.sockets.size);

    socket.on('find_partner', (userData) => {
        // Sanitize Inputs immediately
        const safeTags = Array.isArray(userData.tags) ? userData.tags.map(t => xss(t)) : [];
        let safeNickname = xss(userData.profile?.nickname || 'Stranger').substring(0, 15);
        
        const profile = { 
            nickname: safeNickname, 
            age: xss(userData.profile?.age || '?'), 
            gender: xss(userData.profile?.gender || '') 
        };

        const userTags = safeTags.map(t => String(t).trim().toLowerCase()).filter(t => t);
        
        let matchIndex = -1;

        if (userTags.length > 0) {
            matchIndex = waitingQueue.findIndex(peer => {
                const peerTags = peer.tags;
                const common = peerTags.filter(t => userTags.includes(t));
                return common.length > 0;
            });
        } else {
            matchIndex = waitingQueue.findIndex(peer => peer.tags.length === 0);
        }

        if (matchIndex > -1) {
            const partnerEntry = waitingQueue[matchIndex];
            const partnerSocket = partnerEntry.socket;
            waitingQueue.splice(matchIndex, 1);

            socket.partnerId = partnerSocket.id;
            partnerSocket.partnerId = socket.id;

            socket.emit('match_found', { tags: userTags, partnerProfile: partnerEntry.profile });
            partnerSocket.emit('match_found', { tags: partnerEntry.tags, partnerProfile: profile });
        } else {
            waitingQueue.push({ socket: socket, tags: userTags, profile: profile });
            socket.emit('waiting_for_partner');
        }
    });

    socket.on('send_message', (msg) => {
        if (socket.partnerId) {
            // 1. Sanitize HTML/Script tags
            let cleanMsg = xss(msg);
            
            // 2. Filter Bad Words
            try {
                cleanMsg = filter.clean(cleanMsg); 
            } catch (e) {}

            io.to(socket.partnerId).emit('receive_message', cleanMsg);
        }
    });

    socket.on('send_image', (imgData) => {
        if (socket.partnerId) {
            // Basic check to ensure it's actually an image data string
            if (typeof imgData === 'string' && imgData.startsWith('data:image')) {
                io.to(socket.partnerId).emit('receive_image', imgData);
            }
        }
    });

    socket.on('typing', () => { if (socket.partnerId) io.to(socket.partnerId).emit('partner_typing'); });
    socket.on('stop_typing', () => { if (socket.partnerId) io.to(socket.partnerId).emit('partner_stop_typing'); });

    socket.on('disconnect_partner', () => handleDisconnect(socket));
    socket.on('disconnect', () => {
        handleDisconnect(socket);
        io.emit('user_count', io.sockets.sockets.size); 
    });

    function handleDisconnect(socket) {
        if (socket.partnerId) {
            io.to(socket.partnerId).emit('partner_disconnected');
            const partnerSocket = io.sockets.sockets.get(socket.partnerId);
            if (partnerSocket) partnerSocket.partnerId = null;
        }
        socket.partnerId = null;
        waitingQueue = waitingQueue.filter(user => user.socket.id !== socket.id);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));