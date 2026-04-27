// @ts-nocheck
import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { userOperations } from '@/api/supabaseHelpers';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Register FCM push notification token
  const registerPushNotifications = async (userEmail) => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      // Save user email to SharedPreferences for Java FCM service
      if (Capacitor.getPlatform() === 'android') {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key: 'user_email', value: userEmail });
      }

      // Request POST_NOTIFICATIONS permission for Android 13+
      if (Capacitor.getPlatform() === 'android') {
        const permResult = await PushNotifications.requestPermissions();
        console.log('Push permission result:', permResult.receive);
        if (permResult.receive !== 'granted') {
          console.warn('Push notification permission denied');
          return;
        }
      }
      // Set up listeners BEFORE registering to avoid missing the token callback
      PushNotifications.addListener('registration', async (token) => {
        console.log('FCM token received:', token.value);
        try {
          await userOperations.update(userEmail, { fcm_token: token.value });
          console.log('FCM token saved to database');
        } catch (e) {
          console.error('Failed to save FCM token:', e);
        }
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.error('FCM registration error:', err);
      });

      // Register with FCM - this triggers the 'registration' listener
      await PushNotifications.register();
      console.log('PushNotifications.register() called');
    } catch (error) {
      console.error('Push notification setup failed:', error);
    }
  };

  useEffect(() => {
    checkUserAuth();
  }, []);

  // Detect app minimize (background) / foreground — set online/offline status
  useEffect(() => {
    if (!user?.email) return;

    const setOnline = () => {
      userOperations.update(user.email, { is_online: true, last_seen: new Date().toISOString() }).catch(() => {});
    };
    const setOffline = () => {
      userOperations.update(user.email, { is_online: false, last_seen: new Date().toISOString() }).catch(() => {});
    };

    // Web: document visibility change
    const handleVisibility = () => {
      if (document.hidden) {
        setOffline();
      } else {
        setOnline();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Capacitor native: app pause (minimize) / resume
    let cleanup = () => {};
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        const resumeHandler = App.addListener('appStateChange', (state) => {
          if (state.isActive) {
            setOnline();
          } else {
            setOffline();
          }
        });
        cleanup = () => {
          resumeHandler.then(h => h.remove()).catch(() => {});
        };
      }).catch(() => {});
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      cleanup();
    };
  }, [user?.email]);

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      // Check current Supabase session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (session?.user) {
        // Get user data from users table
        try {
          const userData = await userOperations.getById(session.user.email);
          if (userData) {
            setUser({ ...session.user, ...userData });
            setIsAuthenticated(true);
            // Register push notifications after auth
            registerPushNotifications(session.user.email);
          } else {
            // User exists in auth but not in users table, create user record
            const newUser = {
              email: session.user.email,
              full_name: session.user.user_metadata?.full_name || session.user.email,
              phone: session.user.user_metadata?.phone || '',
              role: 'user',
              is_online: true,
              last_seen: new Date().toISOString(),
            };
            await userOperations.create(newUser);
            setUser({ ...session.user, ...newUser });
            setIsAuthenticated(true);
          }
        } catch (dbError) {
          // If users table doesn't exist yet, use auth data with metadata
          console.warn('Users table not ready, using auth data only:', dbError.message);
          setUser({
            ...session.user,
            full_name: session.user.user_metadata?.full_name || session.user.email,
            phone: '',
          });
          setIsAuthenticated(true);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }

      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setAuthError({
        type: 'auth_error',
        message: error.message || 'Authentication failed'
      });
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = async (email, password) => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        await checkUserAuth();
        registerPushNotifications(email);
        // Set user online
        userOperations.update(email, { is_online: true, last_seen: new Date().toISOString() }).catch(() => {});
        return { success: true };
      }
    } catch (error) {
      setAuthError({
        type: 'login_error',
        message: error.message || 'Login gagal'
      });
      return { success: false, error: error.message };
    }
  };

  const signup = async (email, password, fullName) => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        // Check if email confirmation is required
        if (!data.user.email_confirmed_at) {
          return {
            success: false,
            error: 'Please check your email to confirm your account. Or disable email confirmation in Supabase Dashboard.'
          };
        }

        // Create user record in users table
        try {
          const newUser = {
            email: email,
            full_name: fullName,
            phone: '',
            role: 'user',
            is_online: true,
            last_seen: new Date().toISOString(),
          };
          await userOperations.create(newUser);
        } catch (dbError) {
          console.warn('Could not create user record in database:', dbError.message);
        }
        await checkUserAuth();
        return { success: true };
      }
    } catch (error) {
      setAuthError({
        type: 'signup_error',
        message: error.message || 'Signup failed'
      });
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      // Set user offline before signing out
      if (user?.email) {
        await userOperations.update(user.email, { is_online: false, last_seen: new Date().toISOString() }).catch(() => {});
      }
      await supabase.auth.signOut();
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const refreshUser = async () => {
    await checkUserAuth();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authError,
      authChecked,
      login,
      signup,
      logout,
      checkUserAuth,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
