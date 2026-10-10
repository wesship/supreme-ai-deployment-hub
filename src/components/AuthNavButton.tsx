import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, LayoutDashboard } from 'lucide-react';

export default function AuthNavButton() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (authed === null) return null;

  return (
    <div className="fixed top-3 right-3 z-50 flex gap-2">
      {authed ? (
        <>
          <Button asChild size="sm" variant="secondary">
            <Link to="/dashboard">
              <LayoutDashboard className="h-4 w-4 mr-1" /> Dashboard
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate('/');
            }}
          >
            <LogOut className="h-4 w-4 mr-1" /> Sign Out
          </Button>
        </>
      ) : (
        <Button asChild size="sm">
          <Link to="/login">
            <LogIn className="h-4 w-4 mr-1" /> Sign In
          </Link>
        </Button>
      )}
    </div>
  );
}
