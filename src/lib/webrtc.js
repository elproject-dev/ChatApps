// @ts-nocheck
import { supabase } from '@/api/supabaseClient';

// Google's public STUN servers for NAT traversal
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let callSubscription = null;

// Callbacks for UI updates
let onRemoteStreamCallback = null;
let onCallEndedCallback = null;
let onCallStatusCallback = null;
let onCallConnectedCallback = null;

export const setCallbacks = ({ onRemoteStream, onCallEnded, onCallStatus, onCallConnected }) => {
  onRemoteStreamCallback = onRemoteStream;
  onCallEndedCallback = onCallEnded;
  onCallStatusCallback = onCallStatus;
  onCallConnectedCallback = onCallConnected;
};

// Get local audio stream
export const getLocalStream = async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    return localStream;
  } catch (error) {
    console.error('Failed to get local stream:', error);
    throw error;
  }
};

// Stop local stream
const stopLocalStream = () => {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
};

// Create peer connection
const createPeerConnection = () => {
  peerConnection = new RTCPeerConnection(ICE_SERVERS);

  // Add local tracks
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
  }

  // Handle remote stream
  peerConnection.ontrack = (event) => {
    remoteStream = event.streams[0];
    if (onRemoteStreamCallback) {
      onRemoteStreamCallback(remoteStream);
    }
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    // ICE candidates are collected and stored in the calls table
    // They will be sent when the SDP is ready
  };

  // Handle connection state changes
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;
    if (onCallStatusCallback) {
      onCallStatusCallback(state);
    }
    if (state === 'disconnected' || state === 'failed' || state === 'closed') {
      endCall();
    }
  };

  return peerConnection;
};

// Initiate a call (caller side)
export const initiateCall = async (callerEmail, calleeEmail, conversationId) => {
  try {
    // Get local audio stream
    await getLocalStream();

    // Create peer connection
    createPeerConnection();

    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Wait for ICE gathering to complete (with timeout)
    await waitForIceGathering();

    // Get all ICE candidates that were gathered
    const localDescription = peerConnection.localDescription;

    // Insert call record with offer SDP
    const { data, error } = await supabase
      .from('calls')
      .insert({
        conversation_id: conversationId,
        caller_email: callerEmail,
        callee_email: calleeEmail,
        status: 'ringing',
        offer_sdp: JSON.stringify(localDescription),
        ice_candidates_caller: JSON.stringify(
          gatherIceCandidates()
        ),
      })
      .select()
      .single();

    if (error) throw error;

    // Subscribe to call updates (waiting for answer)
    subscribeToCallUpdates(data.id, calleeEmail);

    return data;
  } catch (error) {
    console.error('Failed to initiate call:', error);
    stopLocalStream();
    throw error;
  }
};

// Answer a call (callee side)
export const answerCall = async (callData) => {
  try {
    // Get local audio stream
    await getLocalStream();

    // Create peer connection
    createPeerConnection();

    // Set remote description (offer from caller)
    const offer = JSON.parse(callData.offer_sdp);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Add caller's ICE candidates (may be JSON string from DB)
    let callerCandidates = callData.ice_candidates_caller || [];
    if (typeof callerCandidates === 'string') {
      try {
        callerCandidates = JSON.parse(callerCandidates);
      } catch (e) {
        console.warn('Failed to parse ice_candidates_caller:', e);
        callerCandidates = [];
      }
    }
    for (const candidate of callerCandidates) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Failed to add ICE candidate:', e);
      }
    }

    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Wait for ICE gathering
    await waitForIceGathering();

    const localDescription = peerConnection.localDescription;

    // Update call record with answer SDP
    const connectedAt = new Date().toISOString();
    const { error } = await supabase
      .from('calls')
      .update({
        status: 'answered',
        answer_sdp: JSON.stringify(localDescription),
        ice_candidates_callee: JSON.stringify(gatherIceCandidates()),
        connected_at: connectedAt,
        updated_at: connectedAt,
      })
      .eq('id', callData.id);

    if (error) throw error;

    // Subscribe to call updates
    subscribeToCallUpdates(callData.id, callData.callee_email);
  } catch (error) {
    console.error('Failed to answer call:', error);
    stopLocalStream();
    throw error;
  }
};

// Reject a call
export const rejectCall = async (callId) => {
  await supabase
    .from('calls')
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
    })
    .eq('id', callId);
};

// End an active call
export const endCall = async (callId) => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  stopLocalStream();

  if (callId) {
    await supabase
      .from('calls')
      .update({
        status: 'ended',
        updated_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
      })
      .eq('id', callId);
  }

  if (callSubscription) {
    callSubscription.unsubscribe();
    callSubscription = null;
  }

  if (onCallEndedCallback) {
    onCallEndedCallback();
  }
};

// Subscribe to call updates for signaling
const subscribeToCallUpdates = (callId, userEmail) => {
  if (callSubscription) {
    callSubscription.unsubscribe();
  }

  callSubscription = supabase
    .channel(`call:${callId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'calls',
        filter: `id=eq.${callId}`,
      },
      async (payload) => {
        const call = payload.new;

        // Caller receives answer from callee
        if (call.answer_sdp && peerConnection && peerConnection.signalingState === 'have-local-offer') {
          const answer = JSON.parse(call.answer_sdp);
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

          // Add callee's ICE candidates (may be JSON string from Realtime)
          let calleeCandidates = call.ice_candidates_callee || [];
          if (typeof calleeCandidates === 'string') {
            try {
              calleeCandidates = JSON.parse(calleeCandidates);
            } catch (e) {
              console.warn('Failed to parse ice_candidates_callee:', e);
              calleeCandidates = [];
            }
          }
          for (const candidate of calleeCandidates) {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn('Failed to add ICE candidate:', e);
            }
          }

          // Notify caller of connected_at for synchronized duration
          if (onCallConnectedCallback && call.connected_at) {
            onCallConnectedCallback(call.connected_at);
          }
        }

        // Call was rejected
        if (call.status === 'rejected') {
          await endCall(callId);
        }

        // Call was ended by other party
        if (call.status === 'ended') {
          await endCall(callId);
        }
      }
    )
    .subscribe();
};

// Subscribe to incoming calls (for callee)
export const subscribeToIncomingCalls = (userEmail, onIncomingCall) => {
  return supabase
    .channel('incoming-calls')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'calls',
        filter: `callee_email=eq.${userEmail}`,
      },
      (payload) => {
        const call = payload.new;
        if (call.status === 'ringing') {
          onIncomingCall(call);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'calls',
        filter: `callee_email=eq.${userEmail}`,
      },
      (payload) => {
        const call = payload.new;
        // Caller rejected/ended the call -> dismiss callee's CallScreen
        if (call.status === 'ended' || call.status === 'rejected') {
          onIncomingCall(null);
        }
      }
    )
    .subscribe();
};

// Unsubscribe from incoming calls
export const unsubscribeIncomingCalls = () => {
  supabase.channel('incoming-calls').unsubscribe();
};

// Wait for ICE gathering to complete (max 3 seconds)
const waitForIceGathering = () => {
  return new Promise((resolve) => {
    if (peerConnection.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const timeout = setTimeout(() => resolve(), 3000);
    peerConnection.onicegatheringstatechange = () => {
      if (peerConnection.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        resolve();
      }
    };
  });
};

// Gather all ICE candidates from the peer connection
const gatherIceCandidates = () => {
  // Since we wait for gathering to complete, all candidates are in the local description
  // We can also extract them from the SDP if needed, but the SDP already contains them
  return [];
};

// Get a ringing call by ID (used when app opened from FCM notification)
export const getRingingCall = async (callId) => {
  try {
    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (error) throw error;
    if (data && data.status === 'ringing') {
      return data;
    }
    return null;
  } catch (error) {
    console.error('Failed to get ringing call:', error);
    return null;
  }
};

// Get call history for a conversation
export const getCallHistory = async (conversationId) => {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};
