const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Filter = require('bad-words'); 
const helmet = require('helmet'); 
const rateLimit = require('express-rate-limit'); 
const xss = require('xss'); 

const filter = new Filter(); 
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// --- SECURITY MIDDLEWARE ---
app.use(helmet({
    contentSecurityPolicy: false, 
}));

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 5000, 
    message: "Too many requests from this IP, please try again later."
});
app.use(limiter);
// ---------------------------

app.use(express.static(path.join(__dirname, 'public')));

let waitingQueue = [];

io.on('connection', (socket) => {
    if (io.sockets.sockets.size > 5000) {
        socket.disconnect();
        return;
    }

    io.emit('user_count', io.sockets.sockets.size);

    socket.on('find_partner', (userData) => {
        if (!userData) return; 

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
            if (typeof msg !== 'string') return;

            let cleanMsg = xss(msg);
            
            try {
                cleanMsg = filter.clean(cleanMsg); 
            } catch (e) {}

            io.to(socket.partnerId).emit('receive_message', cleanMsg);
        }
    });

    socket.on('send_image', (imgData) => {
        if (socket.partnerId) {
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