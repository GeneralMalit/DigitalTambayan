'use client'

import AuthForm from "@/components/auth/AuthForm";
import Dashboard from "@/components/Dashboard";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient()

    // check initial session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }
    checkSession()

    // listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, []);

  if (loading) return null;

  return (
    <main className="h-full w-full flex flex-col items-center justify-center relative overflow-hidden bg-[#020202] font-sans selection:bg-blue-500/30">
      {/* Ultra-subtle Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
        {user ? (
          <Dashboard />
        ) : (
          <div className="w-full max-w-lg px-6 flex flex-col items-center gap-12">
            <div className="text-center space-y-4">
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white font-heading">
                Digital <span className="text-zinc-500">Tambayan</span>
              </h1>
              <p className="text-sm font-light text-zinc-500 tracking-[0.3em] uppercase">
                A community for everyone
              </p>
            </div>

            <div className="w-full">
              <AuthForm />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}