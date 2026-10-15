import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { fetchAddressesForUser } from '@/lib/permissions';
import { useTranslation } from '@/lib/i18n';

function readSeen(key) {
  try { const data = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(data) ? data : []; }
  catch { return []; }
}
export default function ShareMessages() {
  const {user} = useAuth();
  const {t} = useTranslation();
  const [messages, setMessages] = useState([]);
  const [seen, setSeen] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const key = `ls-share-messages-seen:${user?.id || ''}`;
  useEffect(() => {
    setMessages([]); setSeen(readSeen(key)); setOpen(false); setError('');
    if (!user?.id) {setLoading(false); return;}
    let active = true, busy = false;
    const load = async () => {
      if (busy || !active) return;
      if (!navigator.onLine) {setError(t('share_messages.offline'));setLoading(false);return;}
      busy = true;
      try {
        const [shares, addresses] = await Promise.all([
          api.entities.SharedAddress.filter({shared_with_user_id:user.id}, '-created_date'),
          fetchAddressesForUser(user, '-updated_date', 0),
        ]);
        const byId = new Map(addresses.filter(a => !a.deleted).map(a => [a.id,a]));
        const data = shares.filter(s => s.shared_with_user_id === user.id && byId.has(s.address_id))
          .map(s => ({...s,address:byId.get(s.address_id)}));
        if (active) {setMessages(data);setError('');}
      } catch {if (active) setError(t('share_messages.error'));}
      finally {busy=false;if(active)setLoading(false);}
    };
    const refresh = () => {if(document.visibilityState==='visible')load();};
    load();
    const interval=window.setInterval(refresh,30000);
    window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
    document.addEventListener('visibilitychange',refresh);
    return () => {active=false;window.clearInterval(interval);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[user?.id,user?.role,user?.circuito_id,user?.congregation]);
  const unread=messages.filter(m => !seen.includes(m.id)).length;
  const markRead = () => {
    const next=[...new Set([...seen,...messages.map(m=>m.id)])].slice(-1000);
    setSeen(next);try {localStorage.setItem(key,JSON.stringify(next));} catch {}
  };
  if(!user) return null;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button variant="outline" size="icon" className="relative shrink-0 rounded-full h-11 w-11 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20" aria-label={`${t('share_messages.title')} (${unread})`}>
        <MessageCircle className="h-5 w-5" />
        {unread>0 && <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">{unread>99?'99+':unread}</span>}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-[calc(100vw-2rem)] sm:w-96 rounded-2xl p-0 overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between gap-2"><h2 className="font-semibold">{t('share_messages.title')}</h2>{unread>0 && <Button size="sm" variant="ghost" className="text-xs" onClick={markRead}>{t('share_messages.mark_read')}</Button>}</div>
      <div className="max-h-[60dvh] overflow-y-auto p-2 space-y-1">
        {loading ? <div className="p-4"><Loader2 className="h-5 w-5 animate-spin" /></div> : error ? <p role="alert" className="p-3 text-sm text-muted-foreground">{error}</p> : !messages.length ? <p className="p-3 text-sm text-muted-foreground">{t('share_messages.empty')}</p> : messages.map(message => <Link key={message.id} to={`/addresses/${message.address_id}`} onClick={() => {const next=[...new Set([...seen,message.id])].slice(-1000);setSeen(next);try{localStorage.setItem(key,JSON.stringify(next));}catch{}setOpen(false);}} className={`block p-3 rounded-xl hover:bg-muted transition-colors ${!seen.includes(message.id)?'bg-primary/10':'bg-muted/30'}`}>
          <p className="text-sm font-medium break-words">{message.address.name}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('share_messages.from')} {message.shared_by_name || t('share_messages.sender')}</p>
          {message.created_date && !isNaN(new Date(message.created_date).getTime()) && <p className="text-xs text-muted-foreground mt-1">{new Date(message.created_date).toLocaleString()}</p>}
        </Link>)}
      </div>
      <Link to="/my-territories" onClick={()=>setOpen(false)} className="block p-3 text-center text-sm text-primary border-t">{t('share_messages.territories')}</Link>
    </PopoverContent>
  </Popover>;
}
