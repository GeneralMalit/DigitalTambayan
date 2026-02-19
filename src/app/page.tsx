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
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full flex justify-center">
        {user ? (
          <Dashboard />
        ) : (
          <div className="w-full max-w-md">
            <h1 className="text-4xl font-black text-white text-center mb-12 tracking-tighter">
              DIGITAL TAMBAYAN
            </h1>
            <AuthForm />
          </div>
        )}
      </div>
    </main>
  );
}