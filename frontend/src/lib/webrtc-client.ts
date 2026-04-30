/**
 * WebRTC Client for Voice and Video Calls
 * This is a simplified implementation for demonstration
 * In production, you'd use a service like Twilio, Agora, or Daily.co
 */

export class WebRTCClient {
  private localStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private callType: 'voice' | 'video' = 'voice';

  async startCall(type: 'voice' | 'video'): Promise<MediaStream> {
    this.callType = type;
    
    try {
      // Request media permissions
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video'
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Initialize peer connection (simplified)
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      return this.localStream;
    } catch (error: any) {
      console.error('Error starting call:', error);
      throw new Error(error.name === 'NotAllowedError' 
        ? 'Camera/microphone permission denied' 
        : 'Failed to start call');
    }
  }

  toggleMute(): boolean {
    if (!this.localStream) return false;
    
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // Return true if muted
    }
    return false;
  }

  toggleVideo(): boolean {
    if (!this.localStream || this.callType !== 'video') return false;
    
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return !videoTrack.enabled; // Return true if video off
    }
    return false;
  }

  endCall(): void {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }
}

// Singleton instance
let webrtcClient: WebRTCClient | null = null;

export function getWebRTCClient(): WebRTCClient {
  if (!webrtcClient) {
    webrtcClient = new WebRTCClient();
  }
  return webrtcClient;
}
