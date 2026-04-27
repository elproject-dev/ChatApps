// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';

const MoveToBackground = Capacitor.isNativePlatform()
  ? registerPlugin('MoveToBackground')
  : null;

const CallNotification = Capacitor.isNativePlatform()
  ? registerPlugin('CallNotification')
  : null;

import Layout from './components/Layout';
import ChatList from './pages/ChatList';
import ChatRoom from './pages/ChatRoom';
import Contacts from './pages/Contacts';
import Profile from './pages/Profile';
import Help from './pages/Help';
import Privacy from './pages/Privacy';
import ThemeSettings from './pages/ThemeSettings';
import NotificationSettings from './pages/NotificationSettings';
import QRPage from './pages/QRPage';
import Login from './pages/Login';
import CallScreen from './components/call/CallScreen';
import { subscribeToIncomingCalls, unsubscribeIncomingCalls, getRingingCall, rejectCall } from '@/lib/webrtc';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [incomingCall, setIncomingCall] = useState(null);

  // Subscribe to incoming calls
  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;

    const sub = subscribeToIncomingCalls(user.email, (call) => {
      setIncomingCall(call);
    });

    // Check for incoming call from FCM notification (when app was in background or screen locked)
    const checkPendingCall = async () => {
      try {
        if (Capacitor.isNativePlatform() && CallNotification) {
          // Check if app was opened from call notification via full-screen intent
          const result = await CallNotification.getPendingCall();
          if (result?.hasPendingCall && result?.callId) {
            const call = await getRingingCall(result.callId);
            if (call) {
              setIncomingCall(call);
            }
          }
        }
      } catch (_) {}
    };
    checkPendingCall();

    // Also check for pending call when app resumes from background
    let appResumeListener = null;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App: CapApp }) => {
        CapApp.addListener('appStateChange', (state) => {
          if (state.isActive) {
            // App came to foreground - check for pending call
            if (CallNotification) {
              CallNotification.getPendingCall().then(async (result) => {
                if (result?.hasPendingCall && result?.callId) {
                  const call = await getRingingCall(result.callId);
                  if (call) {
                    setIncomingCall(call);
                  }
                }
              }).catch(() => {});
              // Also check for rejected call from notification button
              CallNotification.getRejectedCall().then(async (result) => {
                if (result?.hasRejectedCall && result?.callId) {
                  console.log('[App] Rejected call from notification:', result.callId);
                  try {
                    await rejectCall(result.callId);
                  } catch (e) {
                    console.error('[App] Failed to reject call:', e);
                  }
                  setIncomingCall(null);
                }
              }).catch(() => {});
            }
          }
        });
      }).catch(() => {});
    }

    // Poll for rejected call from notification (when app is in foreground)
    let rejectedCallInterval = null;
    if (Capacitor.isNativePlatform() && CallNotification) {
      rejectedCallInterval = setInterval(async () => {
        try {
          const result = await CallNotification.getRejectedCall();
          if (result?.hasRejectedCall && result?.callId) {
            console.log('[App] Rejected call from notification (poll):', result.callId);
            try {
              await rejectCall(result.callId);
            } catch (e) {
              console.error('[App] Failed to reject call:', e);
            }
            setIncomingCall(null);
          }
        } catch (_) {}
      }, 1000);
    }

    return () => {
      unsubscribeIncomingCalls();
      if (rejectedCallInterval) clearInterval(rejectedCallInterval);
    };
  }, [isAuthenticated, user?.email]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handler = ({ canGoBack }) => {
      const currentPath = window.location.pathname;

      // If on ChatList (home), minimize app to background
      if (currentPath === '/') {
        if (MoveToBackground) {
          MoveToBackground.moveToBackground();
        }
        return;
      }

      // If on ChatRoom, go back to home (unless image preview is open)
      if (currentPath.startsWith('/chat/')) {
        const previewOverlay = document.querySelector('[data-image-preview]');
        if (previewOverlay) {
          // Image preview is open, dispatch custom event to close it
          window.dispatchEvent(new CustomEvent('closeImagePreview'));
          return;
        }
        navigate('/', { replace: false });
        return;
      }

      // Sub-pages of Profile: go back to Profile first
      if (currentPath === '/notifications' || currentPath === '/theme' || currentPath === '/help' || currentPath === '/privacy') {
        navigate('/profile', { replace: false });
        return;
      }

      // Contacts or Profile: go to ChatList first
      navigate('/', { replace: false });
    };

    CapacitorApp.addListener('backButton', handler);

    return () => {
      try { CapacitorApp.removeAllListeners(); } catch {}
    };
  }, [navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const sub = LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const conversationId = event?.notification?.extra?.conversation_id;
      if (conversationId) {
        navigate(`/chat/${conversationId}`);
      }
    });

    // Handle push notification tap (app opened from notification)
    const pushSub = PushNotifications.addListener('pushNotificationActionPerformed', async (event) => {
      const data = event?.notification?.data;
      const conversationId = data?.conversation_id;
      const msgType = data?.msg_type;
      const callId = data?.call_id;

      // Handle call notification tap
      if (msgType === 'call' && callId) {
        const call = await getRingingCall(callId);
        if (call) {
          setIncomingCall(call);
        }
        // Stop native ringtone
        if (CallNotification) {
          CallNotification.stopRingtone().catch(() => {});
        }
        return;
      }

      if (conversationId) {
        navigate(`/chat/${conversationId}`);
      }
    });

    return () => {
      try { sub.remove(); } catch {}
      try { pushSub.remove(); } catch {}
    };
  }, [navigate]);

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25">
            <svg className="w-6 h-6 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ChatList />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/help" element={<Help />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/theme" element={<ThemeSettings />} />
          <Route path="/notifications" element={<NotificationSettings />} />
        </Route>
        <Route path="/qr" element={<QRPage />} />
        <Route path="/chat/:id" element={<ChatRoom />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>

      {/* Incoming call overlay */}
      {incomingCall && (
        <CallScreen
          callData={incomingCall}
          currentUserEmail={user?.email}
          onCallEnd={() => setIncomingCall(null)}
        />
      )}
    </>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthenticatedApp />
          </Router>
          <Toaster />
          <SonnerToaster position="top-center" />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App