// @ts-nocheck
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Phone, PhoneOff, PhoneIncoming, PhoneMissed, Volume2, User, PhoneCall } from 'lucide-react';
import { initiateCall, answerCall, rejectCall, endCall, setCallbacks, getRingingCall } from '@/lib/webrtc';
import { userOperations } from '@/api/supabaseHelpers';
import { Capacitor, registerPlugin } from '@capacitor/core';

export default function CallScreen({ callData, currentUserEmail, onCallEnd }) {
  const [status, setStatus] = useState(callData?.status || 'idle'); // idle, ringing, dialing, ringing_remote, connected
  const [callDuration, setCallDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState(null);
  const [otherUserName, setOtherUserName] = useState('');
  const [otherUserAvatar, setOtherUserAvatar] = useState('');
  const remoteAudioRef = useRef(null);
  const durationInterval = useRef(null);
  const currentCallId = useRef(callData?.id || null);
  const ringbackIntervalRef = useRef(null);
  const ringbackAudioRef = useRef(null);

  const isCaller = callData?.caller_email === currentUserEmail;
  const otherEmail = isCaller ? callData?.callee_email : callData?.caller_email;

  // Fetch other user name and avatar
  useEffect(() => {
    if (otherEmail) {
      userOperations.getById(otherEmail).then((user) => {
        setOtherUserName(user?.full_name || 'Unknown');
        setOtherUserAvatar(user?.avatar_url || '');
      }).catch(() => {
        setOtherUserName('Unknown');
        setOtherUserAvatar('');
      });
    }
  }, [otherEmail]);

  // Handle remote stream
  const handleRemoteStream = useCallback((stream) => {
    setRemoteStream(stream);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.play().catch(console.error);
    }
  }, []);

  // Stop native call ringtone and cancel notification
  const stopNativeRingtone = async () => {
    try {
      const { Capacitor, registerPlugin } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const CallNotification = registerPlugin('CallNotification');
        CallNotification.stopRingtone().catch(() => {});
      }
    } catch (_) {}
  };

  // Handle call ended
  const handleCallEnded = useCallback(() => {
    stopNativeRingtone();
    setStatus('ended');
    if (durationInterval.current) clearInterval(durationInterval.current);
    setTimeout(() => onCallEnd(), 1500);
  }, [onCallEnd]);

  // Start duration counter from a shared timestamp
  const startDurationCounter = useCallback((connectedAt) => {
    if (durationInterval.current) clearInterval(durationInterval.current);
    const startMs = new Date(connectedAt).getTime();
    const elapsed = Math.floor((Date.now() - startMs) / 1000);
    setCallDuration(Math.max(0, elapsed));
    durationInterval.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startMs) / 1000);
      setCallDuration(Math.max(0, secs));
    }, 1000);
  }, []);

  // Play ringback tone for caller while dialing
  const startRingbackTone = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      ringbackAudioRef.current = audioCtx;

      const playBeep = () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 440;
        gain.gain.value = 0.4;
        osc.start();
        gain.gain.setTargetAtTime(0, audioCtx.currentTime + 0.8, 0.1);
        osc.stop(audioCtx.currentTime + 1.0);
      };

      // Play first beep immediately, then every 4 seconds
      playBeep();
      ringbackIntervalRef.current = setInterval(() => {
        playBeep();
      }, 4000);
    } catch (e) {
      console.warn('Failed to play ringback tone:', e);
    }
  }, []);

  const stopRingbackTone = useCallback(() => {
    if (ringbackIntervalRef.current) {
      clearInterval(ringbackIntervalRef.current);
      ringbackIntervalRef.current = null;
    }
    if (ringbackAudioRef.current) {
      try { ringbackAudioRef.current.close(); } catch (_) {}
      ringbackAudioRef.current = null;
    }
  }, []);

  // Handle call status change
  const handleCallStatus = useCallback((state) => {
    if (state === 'connected') {
      setStatus('connected');
    }
  }, []);

  // Handle call connected with shared timestamp (caller receives this from Realtime)
  const handleCallConnected = useCallback((connectedAt) => {
    stopRingbackTone();
    setStatus('connected');
    startDurationCounter(connectedAt);
  }, [startDurationCounter, stopRingbackTone]);

  useEffect(() => {
    setCallbacks({
      onRemoteStream: handleRemoteStream,
      onCallEnded: handleCallEnded,
      onCallStatus: handleCallStatus,
      onCallConnected: handleCallConnected,
    });
  }, [handleRemoteStream, handleCallEnded, handleCallStatus, handleCallConnected]);

  // If callee and call is ringing, show incoming call UI
  useEffect(() => {
    if (callData?.status === 'ringing' && !isCaller) {
      setStatus('ringing');
    } else if (callData?.status === 'ringing' && isCaller) {
      setStatus('dialing');
      startRingbackTone();
      // After 3s, switch to "Berdering" (callee device is ringing by then)
      setTimeout(() => setStatus((s) => s === 'dialing' ? 'ringing_remote' : s), 3000);
    }
    return () => stopRingbackTone();
  }, [callData, isCaller, startRingbackTone, stopRingbackTone]);

  // Cleanup: stop native ringtone and ringback when CallScreen unmounts
  useEffect(() => {
    return () => {
      stopNativeRingtone();
      stopRingbackTone();
    };
  }, []);

  // Handle answer button
  const handleAnswer = async () => {
    try {
      console.log('[CallScreen] handleAnswer called, callData:', JSON.stringify(callData));
      await stopNativeRingtone();
      console.log('[CallScreen] ringtone stopped');
      // Fetch full call data from DB (Realtime INSERT may not include offer_sdp)
      let fullCallData = callData;
      if (!callData?.offer_sdp && callData?.id) {
        console.log('[CallScreen] offer_sdp missing, fetching from DB...');
        const freshCall = await getRingingCall(callData.id);
        if (freshCall) {
          fullCallData = freshCall;
          console.log('[CallScreen] fresh call data, offer_sdp:', !!freshCall.offer_sdp, 'ice_candidates_caller:', !!freshCall.ice_candidates_caller);
        } else {
          throw new Error('Call no longer ringing');
        }
      } else {
        console.log('[CallScreen] offer_sdp present in callData:', !!callData?.offer_sdp);
      }
      console.log('[CallScreen] calling answerCall...');
      await answerCall(fullCallData);
      console.log('[CallScreen] answerCall succeeded');
      stopRingbackTone();
      setStatus('connected');
      currentCallId.current = fullCallData.id;
      // Start duration counter using the same connectedAt timestamp saved to DB
      startDurationCounter(new Date().toISOString());
    } catch (error) {
      console.error('[CallScreen] Failed to answer call:', error?.message || error);
      handleCallEnded();
    }
  };

  // Handle reject button
  const handleReject = async () => {
    try {
      stopNativeRingtone();
      await rejectCall(callData.id);
    } catch (error) {
      console.error('Failed to reject call:', error);
    }
    handleCallEnded();
  };

  // Handle end call button
  const handleEndCall = async () => {
    try {
      stopNativeRingtone();
      await endCall(currentCallId.current);
    } catch (error) {
      console.error('Failed to end call:', error);
    }
    handleCallEnded();
  };

  // Format duration
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-primary via-primary/95 to-primary/80 backdrop-blur-xl flex flex-col items-center justify-between py-8 px-6">
      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Top section - Caller info with avatar */}
      <div className="flex flex-col items-center gap-6 mt-8">
        {/* Avatar */}
        <div className="relative">
          {/* Animated ripples for incoming call */}
          {status === 'ringing' && (
            <>
              <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" style={{ animationDuration: '1.5s' }} />
              <div className="absolute inset-0 rounded-full bg-white/30 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
              <div className="absolute inset-0 rounded-full bg-white/40 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.6s' }} />
            </>
          )}

          {/* Avatar */}
          <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-sm border-4 border-white/20 shadow-2xl overflow-hidden flex items-center justify-center">
            {otherUserAvatar ? (
              <img src={otherUserAvatar} alt={otherUserName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-16 h-16 text-white/80" />
            )}
          </div>

          {/* Status indicator */}
          {status === 'connected' && (
            <div className="absolute bottom-0 right-0 w-8 h-8 bg-green-500 rounded-full border-4 border-primary shadow-lg flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            </div>
          )}
        </div>

        {/* Name and status */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
            {otherUserName || 'Unknown'}
          </h2>
          <p className="text-white/80 text-lg font-medium">
            {status === 'ringing' && 'Panggilan masuk...'}
            {status === 'dialing' && 'Menghubungi...'}
            {status === 'ringing_remote' && 'Berdering...'}
            {status === 'connected' && formatDuration(callDuration)}
            {status === 'ended' && 'Panggilan berakhir'}
          </p>
        </div>
      </div>

      {/* Middle - Visual indicators */}
      <div className="flex-1 flex items-center justify-center">
        {status === 'ringing' && (
          <div className="flex gap-3">
            <div className="w-4 h-4 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-4 h-4 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '100ms' }} />
            <div className="w-4 h-4 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '200ms' }} />
          </div>
        )}

        {(status === 'dialing' || status === 'ringing_remote') && (
          <div className="flex gap-3">
            <div className="w-4 h-4 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-4 h-4 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-4 h-4 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {status === 'connected' && (
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <Volume2 className="w-4 h-4" />
            <span>Panggilan aktif</span>
          </div>
        )}
      </div>

      {/* Bottom section - Call controls */}
      <div className="flex items-center gap-8 mb-8">
        {status === 'ringing' && (
          <>
            {/* Reject button */}
            <button
              onClick={handleReject}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-2xl shadow-red-500/30 active:scale-90 transition-all duration-200 hover:shadow-red-500/50"
            >
              <PhoneMissed className="w-9 h-9 text-white" />
            </button>
            {/* Answer button */}
            <button
              onClick={handleAnswer}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-2xl shadow-green-500/30 active:scale-90 transition-all duration-200 hover:shadow-green-500/50"
            >
              <Phone className="w-9 h-9 text-white" />
            </button>
          </>
        )}

        {(status === 'dialing' || status === 'ringing_remote' || status === 'connected') && (
          <>
            {/* End call button */}
            <button
              onClick={handleEndCall}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-2xl shadow-red-500/30 active:scale-90 transition-all duration-200 hover:shadow-red-500/50"
            >
              <PhoneOff className="w-9 h-9 text-white" />
            </button>
          </>
        )}

        {status === 'ended' && (
          <button
            onClick={onCallEnd}
            className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-xl active:scale-90 transition-all duration-200"
          >
            <PhoneMissed className="w-7 h-7 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
