// Variables globales
let localStream = null;
let screenStream = null;
let peerConnections = {};
let meetingCode = '';
let isAudioMuted = false;
let isVideoOff = false;
let isScreenSharing = false;
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let participantId = Math.random().toString(36).substring(2, 10);
let isHost = false;
let signalingChannel = null;
let participants = 0;

// Configuración de WebRTC
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Simulación de canal de señalización
class SignalingChannel {
    constructor(meetingCode) {
        this.meetingCode = meetingCode;
        this.onmessage = null;
        this.interval = null;
        this.connect();
    }
    
    connect() {
        console.log("Conectando al canal de señalización...");
        this.interval = setInterval(() => {
            if (Math.random() > 0.8 && this.onmessage) {
                const fakeMessages = [
                    { type: 'user-joined', userId: 'user_' + Math.random().toString(36).substring(2, 8) },
                    { type: 'offer', sdp: 'fake-sdp', userId: 'user_' + Math.random().toString(36).substring(2, 8) },
                    { type: 'ice-candidate', candidate: 'fake-candidate', userId: 'user_' + Math.random().toString(36).substring(2, 8) }
                ];
                const randomMsg = fakeMessages[Math.floor(Math.random() * fakeMessages.length)];
                this.onmessage({ data: JSON.stringify(randomMsg) });
            }
        }, 3000);
    }
    
    send(data) {
        console.log("Enviando mensaje:", data);
    }
    
    disconnect() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}

// Elementos DOM
const createMeetingBtn = document.getElementById('create-meeting-btn');
const joinMeetingBtn = document.getElementById('join-meeting-btn');
const createMeetingSection = document.getElementById('create-meeting-section');
const joinMeetingSection = document.getElementById('join-meeting-section');
const generateCodeBtn = document.getElementById('generate-code-btn');
const meetingInfo = document.getElementById('meeting-info');
const meetingCodeSpan = document.getElementById('meeting-code');
const meetingLinkSpan = document.getElementById('meeting-link');
const copyInfoBtn = document.getElementById('copy-info-btn');
const startCallBtn = document.getElementById('start-call-btn');
const meetingCodeInput = document.getElementById('meeting-code-input');
const joinBtn = document.getElementById('join-btn');
const homeTab = document.getElementById('home-tab');
const callTab = document.getElementById('call-tab');
const activeMeetingCode = document.getElementById('active-meeting-code');
const localVideo = document.getElementById('local-video');
const videosContainer = document.getElementById('videos-container');
const muteBtn = document.getElementById('mute-btn');
const videoBtn = document.getElementById('video-btn');
const screenShareBtn = document.getElementById('screen-share-btn');
const recordBtn = document.getElementById('record-btn');
const fullMuteBtn = document.getElementById('full-mute-btn');
const fullVideoBtn = document.getElementById('full-video-btn');
const fullScreenShareBtn = document.getElementById('full-screen-share-btn');
const hangupBtn = document.getElementById('hangup-btn');
const toast = document.getElementById('toast');
const participantCount = document.getElementById('participant-count');
const participantList = document.getElementById('participant-list');

// Event Listeners
createMeetingBtn.addEventListener('click', showCreateMeeting);
joinMeetingBtn.addEventListener('click', showJoinMeeting);
generateCodeBtn.addEventListener('click', generateMeetingCode);
copyInfoBtn.addEventListener('click', copyMeetingInfo);
startCallBtn.addEventListener('click', startCall);
joinBtn.addEventListener('click', joinMeeting);
muteBtn.addEventListener('click', toggleAudio);
videoBtn.addEventListener('click', toggleVideo);
screenShareBtn.addEventListener('click', toggleScreenShare);
recordBtn.addEventListener('click', toggleRecording);
fullMuteBtn.addEventListener('click', toggleAudio);
fullVideoBtn.addEventListener('click', toggleVideo);
fullScreenShareBtn.addEventListener('click', toggleScreenShare);
hangupBtn.addEventListener('click', hangUp);

// Funciones de la UI
function showCreateMeeting() {
    createMeetingSection.classList.remove('hidden');
    joinMeetingSection.classList.add('hidden');
}

function showJoinMeeting() {
    joinMeetingSection.classList.remove('hidden');
    createMeetingSection.classList.add('hidden');
}

function generateMeetingCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    meetingCode = '';
    for (let i = 0; i < 10; i++) {
        meetingCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    meetingCodeSpan.textContent = meetingCode;
    meetingLinkSpan.textContent = `${window.location.origin}${window.location.pathname}?meeting=${meetingCode}`;
    meetingInfo.classList.remove('hidden');
    
    showToast('Código de reunión generado');
}

function copyMeetingInfo() {
    const info = `Código: ${meetingCode}\nEnlace: ${window.location.origin}${window.location.pathname}?meeting=${meetingCode}`;
    navigator.clipboard.writeText(info).then(() => {
        showToast('Información copiada al portapapeles');
    });
}

async function startCall() {
    if (!meetingCode) {
        showToast('Primero genera un código de reunión', 'error');
        return;
    }
    
    isHost = true;
    participants = 1;
    updateParticipantCount();
    await initializeMeeting(true);
}

async function joinMeeting() {
    const code = meetingCodeInput.value.trim();
    if (code.length !== 10) {
        showToast('El código debe tener 10 caracteres', 'error');
        return;
    }
    
    meetingCode = code;
    isHost = false;
    participants = 1;
    updateParticipantCount();
    await initializeMeeting(false);
}

async function initializeMeeting(isHost) {
    try {
        activeMeetingCode.textContent = meetingCode;
        homeTab.classList.remove('active');
        callTab.classList.add('active');
        
        signalingChannel = new SignalingChannel(meetingCode);
        signalingChannel.onmessage = handleSignalingMessage;
        
        await getLocalStream();
        
        showToast(isHost ? 'Reunión iniciada como anfitrión' : 'Te has unido a la reunión');
        
        simulateParticipants();
        
    } catch (error) {
        console.error('Error inicializando la reunión:', error);
        showToast('Error al iniciar la reunión', 'error');
    }
}

async function getLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        localVideo.srcObject = localStream;
        
        return localStream;
    } catch (error) {
        console.error('Error accediendo a medios:', error);
        showToast('Error al acceder a cámara/micrófono', 'error');
        throw error;
    }
}

async function shareScreen() {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });
        
        localVideo.srcObject = screenStream;
        isScreenSharing = true;
        
        screenStream.getVideoTracks()[0].onended = stopScreenShare;
        
        showToast('Compartiendo pantalla');
        
    } catch (error) {
        console.error('Error al compartir pantalla:', error);
        showToast('Error al compartir pantalla', 'error');
    }
}

function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    
    localVideo.srcObject = localStream;
    isScreenSharing = false;
    
    showToast('Dejaste de compartir pantalla');
}

function toggleScreenShare() {
    if (isScreenSharing) {
        stopScreenShare();
    } else {
        shareScreen();
    }
}

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (!localStream) {
        showToast('No hay stream para grabar', 'error');
        return;
    }
    
    try {
        recordedChunks = [];
        
        const mixedStream = new MediaStream();
        
        localStream.getTracks().forEach(track => {
            mixedStream.addTrack(track);
        });
        
        mediaRecorder = new MediaRecorder(mixedStream, {
            mimeType: 'video/webm;codecs=vp9,opus'
        });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `videollamada-${meetingCode}-${new Date().toISOString().slice(0, 19)}.webm`;
            a.click();
            
            URL.revokeObjectURL(url);
        };
        
        mediaRecorder.start();
        isRecording = true;
        recordBtn.classList.add('recording');
        
        showToast('Grabación iniciada');
        
    } catch (error) {
        console.error('Error al iniciar grabación:', error);
        showToast('Error al iniciar grabación', 'error');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        recordBtn.classList.remove('recording');
        
        showToast('Grabación detenida y descargada');
    }
}

function toggleAudio() {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            isAudioMuted = !isAudioMuted;
            audioTracks[0].enabled = !isAudioMuted;
            muteBtn.textContent = isAudioMuted ? '🔊' : '🔇';
            fullMuteBtn.textContent = isAudioMuted ? '🔊' : '🔇';
            showToast(isAudioMuted ? 'Audio silenciado' : 'Audio activado');
        }
    }
}

function toggleVideo() {
    if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            isVideoOff = !isVideoOff;
            videoTracks[0].enabled = !isVideoOff;
            videoBtn.textContent = isVideoOff ? '📷' : '📹';
            fullVideoBtn.textContent = isVideoOff ? '📷' : '📹';
            showToast(isVideoOff ? 'Video desactivado' : 'Video activado');
        }
    }
}

function hangUp() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
    }
    
    if (isRecording) {
        stopRecording();
    }
    
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};
    
    if (signalingChannel) {
        signalingChannel.disconnect();
        signalingChannel = null;
    }
    
    homeTab.classList.add('active');
    callTab.classList.remove('active');
    
    const remoteVideos = videosContainer.querySelectorAll('.video-wrapper:not(.local-video)');
    remoteVideos.forEach(video => video.remove());
    
    // Limpiar lista de participantes
    const participantChips = participantList.querySelectorAll('.participant-chip:not(:first-child)');
    participantChips.forEach(chip => chip.remove());
    
    localStream = null;
    screenStream = null;
    meetingCode = '';
    isAudioMuted = false;
    isVideoOff = false;
    isScreenSharing = false;
    isRecording = false;
    participants = 0;
    updateParticipantCount();
    
    showToast('Llamada finalizada');
}

function createPeerConnection(userId) {
    const pc = new RTCPeerConnection(configuration);
    
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }
    
    pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        addRemoteVideo(remoteStream, userId);
    };
    
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            signalingChannel.send({
                type: 'ice-candidate',
                candidate: event.candidate,
                target: userId
            });
        }
    };
    
    peerConnections[userId] = pc;
    return pc;
}

function addRemoteVideo(stream, userId) {
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-wrapper';
    videoWrapper.id = `remote-video-${userId}`;
    
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    
    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = `Participante ${userId.substring(0, 5)}`;
    
    videoWrapper.appendChild(video);
    videoWrapper.appendChild(label);
    
    videosContainer.appendChild(videoWrapper);
    
    participants++;
    updateParticipantCount();
    
    const participantChip = document.createElement('div');
    participantChip.className = 'participant-chip';
    participantChip.innerHTML = `<i class="fas fa-user"></i> Participante ${userId.substring(0, 5)}`;
    participantList.appendChild(participantChip);
}

function updateParticipantCount() {
    participantCount.textContent = participants;
}

function handleSignalingMessage(event) {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
        case 'user-joined':
            showToast(`Nuevo participante: ${message.userId}`);
            createPeerConnection(message.userId);
            break;
            
        case 'offer':
            handleOffer(message);
            break;
            
        case 'answer':
            handleAnswer(message);
            break;
            
        case 'ice-candidate':
            handleIceCandidate(message);
            break;
            
        default:
            console.warn('Tipo de mensaje desconocido:', message.type);
    }
}

async function handleOffer(message) {
    const pc = peerConnections[message.userId] || createPeerConnection(message.userId);
    
    await pc.setRemoteDescription(message.offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    signalingChannel.send({
        type: 'answer',
        answer: answer,
        target: message.userId
    });
}

async function handleAnswer(message) {
    const pc = peerConnections[message.userId];
    if (pc) {
        await pc.setRemoteDescription(message.answer);
    }
}

async function handleIceCandidate(message) {
    const pc = peerConnections[message.userId];
    if (pc) {
        await pc.addIceCandidate(message.candidate);
    }
}

function simulateParticipants() {
    if (!isHost) return;
    
    setTimeout(() => {
        if (videosContainer.querySelectorAll('.video-wrapper:not(.local-video)').length === 0) {
            const simulatedStream = localStream.clone();
            addRemoteVideo(simulatedStream, 'participant1');
            showToast('Juan se ha unido a la reunión');
        }
    }, 2000);
    
    setTimeout(() => {
        if (videosContainer.querySelectorAll('.video-wrapper:not(.local-video)').length === 1) {
            const simulatedStream = localStream.clone();
            addRemoteVideo(simulatedStream, 'participant2');
            showToast('María se ha unido a la reunión');
        }
    }, 5000);
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = 'toast show';
    if (type === 'error') {
        toast.style.background = 'var(--danger)';
    } else {
        toast.style.background = 'var(--dark)';
    }
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

function checkUrlForMeetingCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const meetingParam = urlParams.get('meeting');
    
    if (meetingParam && meetingParam.length === 10) {
        meetingCodeInput.value = meetingParam;
        showJoinMeeting();
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('SW registrado: ', registration);
            })
            .catch(registrationError => {
                console.log('Error registrando SW: ', registrationError);
            });
    });
}

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

checkUrlForMeetingCode();