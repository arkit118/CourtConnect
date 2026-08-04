import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, AlertCircle, Users, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { useActionGate } from '../hooks/useActionGate';
import { useSocialEligibility } from '../hooks/useSocialEligibility';
import { SocialOnboardingGate } from '../components/SocialOnboardingGate';
import { SocialSafetyBanner } from '../components/SocialSafetyBanner';
import { ChatSafetyCard } from '../components/ChatSafetyCard';
import { ReportButton } from '../components/ReportButton';
import { BlockButton } from '../components/BlockButton';
import { supabase, Match, Message, Profile } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';

const MAX_MESSAGE_LENGTH = 2000;

export function ChatPage() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const { addToast } = useToastStore();
  const canProceed = useActionGate();
  const eligibility = useSocialEligibility();

  const [match, setMatch] = useState<Match | null>(null);
  const [other, setOther] = useState<Pick<Profile, 'id' | 'name' | 'avatar_url' | 'home_town'> | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showSafetyCard, setShowSafetyCard] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMatchAndMessages = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: matchData, error: matchError } = await withTimeout(
        supabase.from('matches').select('*').eq('id', id).single(),
        15000,
        'Loading this chat timed out. Please try refreshing.'
      );
      if (matchError) throw matchError;
      setMatch(matchData);

      const otherId = matchData.user_a === user.id ? matchData.user_b : matchData.user_a;
      const { data: otherProfile, error: otherError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, home_town')
        .eq('id', otherId)
        .single();
      if (otherError) throw otherError;
      setOther(otherProfile);

      if (matchData.status === 'active') {
        const { data: msgData, error: msgError } = await withTimeout(
          supabase
            .from('messages')
            .select('*')
            .eq('match_id', id)
            .order('created_at', { ascending: true }),
          15000,
          'Loading messages timed out. Please try refreshing.'
        );
        if (msgError) throw msgError;
        setMessages(msgData || []);
      }
    } catch (err: any) {
      console.error('Error loading chat:', err);
      setError(err.message || 'Failed to load this chat');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    if (eligibility === 'eligible') {
      fetchMatchAndMessages();
    } else {
      setLoading(false);
    }
  }, [eligibility, fetchMatchAndMessages]);

  // Realtime subscription for new messages, with manual refetch as the
  // source of truth on load - if realtime ever misses an event, opening
  // the chat again or sending a message still works correctly.
  useEffect(() => {
    if (!id || !match || match.status !== 'active') return;

    const channel = supabase
      .channel(`messages-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === (payload.new as Message).id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, match?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const doSend = async (trimmed: string) => {
    if (!user || !id) return;
    setSending(true);
    try {
      const { data, error: insertError } = await withTimeout(
        supabase
          .from('messages')
          .insert({ match_id: id, sender_id: user.id, body: trimmed })
          .select()
          .single(),
        15000,
        'Sending your message timed out. Please try again.'
      );
      if (insertError) throw insertError;

      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      setBody('');
    } catch (err: any) {
      console.error('Error sending message:', err);
      addToast({ type: 'error', message: err.message || 'Failed to send message' });
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !match || !id) return;

    const trimmed = body.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      addToast({ type: 'error', message: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.` });
      return;
    }

    if (!(await canProceed())) return;

    if (!profile?.chat_safety_acknowledged_at) {
      setShowSafetyCard(true);
      return;
    }

    await doSend(trimmed);
  };

  if (eligibility !== 'eligible') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container-custom max-w-lg">
          <SocialOnboardingGate status={eligibility} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container-custom max-w-lg">
          <div className="rounded-3xl bg-white border border-secondary-200 p-12 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <p className="font-display text-secondary-900 font-semibold mb-1">Couldn't load this chat</p>
            <p className="text-secondary-600 text-sm mb-4">{error}</p>
            <Link to="/matches" className="btn-outline">Back to Matches</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!match) return null;

  const isLocked = match.status !== 'active';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-secondary-100 sticky top-16 md:top-20 z-30">
        <div className="container-custom max-w-3xl py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/matches" className="p-2 rounded-lg hover:bg-secondary-50 shrink-0">
              <ArrowLeft className="w-5 h-5 text-secondary-600" />
            </Link>
            {other?.avatar_url ? (
              <img src={other.avatar_url} alt={other.name} className="w-9 h-9 rounded-lg object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary-500" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-secondary-900 truncate">{other?.name || 'CourtConnect member'}</p>
              {other?.home_town && <p className="text-xs text-secondary-500 truncate">{other.home_town}</p>}
            </div>
          </div>
          {other && (
            <div className="flex items-center gap-2 shrink-0">
              <ReportButton reportType="user" targetId={other.id} reportedUserId={other.id} label="Report" />
              <BlockButton blockedUserId={other.id} onBlocked={fetchMatchAndMessages} />
            </div>
          )}
        </div>
      </div>

      <div className="container-custom max-w-3xl py-4">
        <SocialSafetyBanner />
      </div>

      {isLocked ? (
        <div className="container-custom max-w-3xl flex-1 flex items-center justify-center pb-12">
          <div className="card p-8 text-center max-w-md">
            <Lock className="w-10 h-10 text-secondary-400 mx-auto mb-4" />
            <h3 className="font-display text-lg font-bold text-secondary-900 mb-2">
              {match.status === 'pending' && 'This match is not active yet'}
              {match.status === 'declined' && 'This match was declined'}
              {match.status === 'ended' && 'This match has ended'}
              {match.status === 'blocked' && 'This chat is no longer available'}
            </h3>
            <p className="text-sm text-secondary-600 mb-4">Chat is only available for active matches.</p>
            <Link to="/matches" className="btn-outline">Back to Matches</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 container-custom max-w-3xl overflow-y-auto pb-4">
            {messages.length === 0 ? (
              <div className="text-center text-secondary-500 text-sm py-12">
                Say hello! No messages yet.
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((m) => {
                  const isOwn = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                          isOwn ? 'bg-primary-500 text-white' : 'bg-white border border-secondary-100 text-secondary-800'
                        }`}
                      >
                        {m.deleted_at ? <span className="italic opacity-70">Message deleted</span> : m.body}
                        <div className={`text-[10px] mt-1 ${isOwn ? 'text-primary-100' : 'text-secondary-400'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="bg-white border-t border-secondary-100 sticky bottom-0">
            <form onSubmit={handleSend} className="container-custom max-w-3xl py-3 flex items-end gap-2">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as unknown as React.FormEvent);
                  }
                }}
                placeholder="Type a message..."
                className="input flex-1 min-h-[44px] max-h-32 resize-none"
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={sending}
              />
              <button type="submit" className="btn-primary shrink-0" disabled={sending || !body.trim()}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </>
      )}

      {showSafetyCard && (
        <ChatSafetyCard
          onAcknowledged={() => {
            setShowSafetyCard(false);
            const trimmed = body.trim();
            if (trimmed) {
              doSend(trimmed);
            }
          }}
        />
      )}
    </div>
  );
}
