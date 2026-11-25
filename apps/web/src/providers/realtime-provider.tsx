'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { WS_EVENTS } from '@marketingspa/shared';
import { authStorage } from '@/lib/auth-storage';
import { invalidateLeadWorkspace } from '@/lib/lead-query-sync';
import { useCurrentUser } from '@/hooks/use-auth';

function resolveApiUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return window.location.origin;
    }
  }
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv && !fromEnv.includes('localhost') && !fromEnv.includes('127.0.0.1')) {
    return fromEnv.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return fromEnv?.replace(/\/$/, '') || 'http://localhost:4000';
}

interface RealtimeContextValue {
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function applySocketAuth(socket: Socket) {
  const token = authStorage.getAccessToken() ?? '';
  socket.auth = { token };
}

/**
 * Socket.IO realtime — cập nhật badge/inbox qua React Query.
 * Handshake auth Bearer (không dùng ?token=). Reconnect sau refresh / logout.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user?.organizationId || !authStorage.isAuthenticated()) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket: Socket = io(`${resolveApiUrl()}/events`, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 800,
    });
    applySocketAuth(socket);
    socketRef.current = socket;

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'ms_auth_session_epoch') {
        if (!authStorage.isAuthenticated()) {
          socket.disconnect();
        }
        return;
      }
      if (ev.key !== 'ms_access_token') return;
      if (!ev.newValue || !authStorage.isAuthenticated()) {
        socket.disconnect();
        return;
      }
      applySocketAuth(socket);
      if (!socket.connected) socket.connect();
      else socket.disconnect().connect();
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('ms-auth-v1');
      channel.onmessage = (ev: MessageEvent<{ type?: string; token?: string }>) => {
        const data = ev.data;
        if (data?.type === 'logout') {
          socket.disconnect();
          return;
        }
        if (data?.type === 'access-token' && data.token) {
          applySocketAuth(socket);
          if (!socket.connected) socket.connect();
          else socket.disconnect().connect();
        }
      };
    } catch {
      channel = null;
    }

    window.addEventListener('storage', onStorage);

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on(WS_EVENTS.LEAD_NEW, () => {
      invalidateLeadWorkspace(queryClient);
    });

    socket.on(WS_EVENTS.LEAD_STALE_ALERT, () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stale-leads'] });
    });

    socket.on(WS_EVENTS.LEAD_SCORE_CHANGED, () => {
      invalidateLeadWorkspace(queryClient);
    });

    socket.on(WS_EVENTS.LEAD_QUALIFIED, () => {
      invalidateLeadWorkspace(queryClient);
    });

    socket.on(WS_EVENTS.LEAD_SLA_BREACHED, () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stale-leads'] });
      invalidateLeadWorkspace(queryClient);
    });

    socket.on(WS_EVENTS.LEAD_REASSIGNED, () => {
      invalidateLeadWorkspace(queryClient);
    });

    socket.on(WS_EVENTS.APPOINTMENT_NEW, () => {
      invalidateLeadWorkspace(queryClient);
    });

    socket.on(WS_EVENTS.APPOINTMENT_REMINDER, () => {
      queryClient.invalidateQueries({ queryKey: ['automation', 'logs'] });
    });

    socket.on(
      WS_EVENTS.CHATBOT_MESSAGE_NEW,
      (payload: { conversationId?: string }) => {
        void queryClient.invalidateQueries({ queryKey: ['chatbot-cskh', 'inbox'] });
        void queryClient.invalidateQueries({ queryKey: ['chatbot-cskh', 'inbox-unread'] });
        if (payload.conversationId) {
          void queryClient.invalidateQueries({
            queryKey: ['chatbot-cskh', 'inbox', 'detail', payload.conversationId],
          });
        }
      },
    );

    socket.on(WS_EVENTS.MESSAGING_CAMPAIGN_UPDATE, () => {
      queryClient.invalidateQueries({ queryKey: ['automation'] });
    });

    socket.on(WS_EVENTS.MESSAGING_CAMPAIGN_RECIPIENT, () => {
      queryClient.invalidateQueries({ queryKey: ['automation'] });
    });

    socket.on(WS_EVENTS.ADS_SYNC_PROGRESS, (payload: unknown) => {
      void queryClient.invalidateQueries({ queryKey: ['ai-ads-manager', 'sync-jobs'] });
      const status =
        payload && typeof payload === 'object' && 'status' in payload
          ? String((payload as { status?: string }).status)
          : '';
      if (status === 'SUCCEEDED' || status === 'FAILED') {
        void queryClient.invalidateQueries({ queryKey: ['ai-ads-manager', 'dashboard'] });
        void queryClient.invalidateQueries({ queryKey: ['ai-ads-manager', 'campaigns'] });
        void queryClient.invalidateQueries({ queryKey: ['ai-ads-manager', 'connections'] });
      }
    });

    socket.connect();

    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.close();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user?.id, user?.organizationId, queryClient]);

  return (
    <RealtimeContext.Provider value={{ connected }}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used within RealtimeProvider');
  return ctx;
}