'use client'

import AuthForm from "@/components/auth/AuthForm";
import Dashboard from "@/components/Dashboard";
import { supabase } from "@/utils/supabase/client";
import { useEffect, useState } from "react";

const previewMessages = [
  { name: "Mika", text: "Final design notes are in the group chat.", tone: "bg-white" },
  { name: "Berto", text: "I can summarize the last 10 messages when you mention me.", tone: "bg-blue-50" },
  { name: "Jo", text: "Renamed the room for our launch sprint.", tone: "bg-emerald-50" },
];

const previewRooms = ["General", "Client Review", "Design QA"];

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pointer, setPointer] = useState({ x: 50, y: 44 });

  useEffect(() => {

    // check initial session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }
    checkSession()

    // listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, []);

  if (loading) return null;

  return (
    <main
      className="h-full w-full relative overflow-hidden bg-[#fbfaf7] font-sans text-stone-950 selection:bg-blue-200/70"
      onMouseMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: ((event.clientX - bounds.left) / bounds.width) * 100,
          y: ((event.clientY - bounds.top) / bounds.height) * 100,
        });
      }}
    >
      {user ? (
        <Dashboard />
      ) : (
        <div className="relative h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="absolute inset-0 tambayan-weave opacity-70" />
          <div
            className="pointer-events-none absolute inset-0 transition-[background] duration-300"
            style={{
              background: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(37, 99, 235, 0.15), transparent 26%), radial-gradient(circle at 78% 20%, rgba(245, 184, 75, 0.18), transparent 24%), radial-gradient(circle at 18% 82%, rgba(22, 163, 74, 0.12), transparent 28%)`,
            }}
          />
          <div className="pointer-events-none absolute left-[8%] top-[16%] h-40 w-40 rounded-full border border-blue-200/70 animate-thread-drift" />
          <div className="pointer-events-none absolute right-[12%] bottom-[14%] h-52 w-52 rounded-full border border-amber-200/80 animate-soft-float" />
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-70" aria-hidden="true">
            <path d="M105 190 C 285 75, 390 345, 565 225 S 890 120, 1085 300 S 1280 525, 1410 365" fill="none" stroke="rgba(37,99,235,.18)" strokeWidth="2" />
            <path d="M35 560 C 220 430, 380 640, 570 510 S 855 390, 1030 545 S 1260 710, 1450 590" fill="none" stroke="rgba(227,93,69,.16)" strokeWidth="2" />
            <path d="M190 760 C 370 625, 475 700, 650 610 S 970 600, 1190 735" fill="none" stroke="rgba(22,163,74,.16)" strokeWidth="2" />
          </svg>

          <div className="relative z-10 min-h-full px-5 py-6 md:px-10 lg:px-12">
            <header className="mx-auto flex max-w-7xl items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-stone-950 text-sm font-bold text-white shadow-sm">
                  DT
                </div>
                <span className="font-heading text-lg font-semibold tracking-tight text-stone-950">
                  Digital Tambayan
                </span>
              </div>
            </header>

            <section className="mx-auto grid min-h-[calc(100vh-92px)] max-w-7xl items-center gap-10 py-10 lg:grid-cols-[0.92fr_1.08fr] lg:py-6">
              <div className="max-w-xl space-y-7">
                <div className="space-y-5">
                  <h1 className="font-heading text-5xl font-semibold leading-[0.98] tracking-tight text-stone-950 md:text-7xl">
                    Digital Tambayan
                  </h1>
                  <p className="max-w-lg text-lg leading-8 text-stone-700">
                    A real-time community chat app with rooms, DMs, private nicknames, photo identity, admin controls, and a helpful AI companion for active groups.
                  </p>
                </div>

                <div id="signin" className="max-w-md rounded-lg border border-stone-200 bg-white/92 p-5 shadow-[0_8px_28px_rgba(87,73,55,0.08)] backdrop-blur">
                  <AuthForm />
                </div>
              </div>

              <div className="relative min-h-[560px]">
                <div className="absolute left-4 top-2 hidden h-12 w-12 items-center justify-center rounded-full bg-[#e35d45] text-sm font-semibold text-white shadow-sm md:flex animate-soft-float">
                  GM
                </div>
                <div className="absolute right-10 top-16 hidden h-10 w-10 items-center justify-center rounded-full bg-[#16a34a] text-sm font-semibold text-white shadow-sm md:flex">
                  AI
                </div>
                <div className="absolute bottom-16 left-0 hidden h-11 w-11 items-center justify-center rounded-full bg-[#f5b84b] text-sm font-semibold text-stone-950 shadow-sm md:flex">
                  Jo
                </div>

                <div className="relative ml-auto flex h-[560px] max-w-2xl overflow-hidden rounded-lg border border-stone-200 bg-white shadow-[0_18px_60px_rgba(80,64,43,0.14)]">
                  <aside className="hidden w-56 shrink-0 border-r border-stone-200 bg-[#f7f4ee] p-4 md:block">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="font-heading text-lg font-semibold">Messages</span>
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    </div>
                    <div className="mb-5 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs text-stone-500">
                      Search rooms
                    </div>
                    <div className="space-y-1">
                      {previewRooms.map((room, index) => (
                        <div key={room} className={`rounded-md px-3 py-2.5 ${index === 1 ? 'bg-white shadow-sm ring-1 ring-stone-200' : 'hover:bg-white/70'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-stone-900">{room}</span>
                            {index === 1 && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                          </div>
                          <p className="mt-1 truncate text-xs text-stone-500">Latest message preview</p>
                        </div>
                      ))}
                    </div>
                  </aside>

                  <div className="flex min-w-0 flex-1 flex-col bg-white">
                    <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-sm font-semibold text-white">CR</div>
                        <div>
                          <h2 className="font-heading text-lg font-semibold text-stone-950">Client Review</h2>
                          <p className="text-xs text-stone-500">8 members, 2 typing</p>
                        </div>
                      </div>
                      <button className="rounded-md border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700">Members</button>
                    </div>

                    <div className="flex-1 space-y-4 overflow-hidden bg-[#fcfbf8] p-5">
                      {previewMessages.map((message, index) => (
                        <div key={message.name} className={`flex gap-3 ${index === 2 ? 'justify-end' : ''}`}>
                          {index !== 2 && (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
                              {message.name.charAt(0)}
                            </div>
                          )}
                          <div className={`max-w-[78%] rounded-md border border-stone-200 px-4 py-3 text-sm leading-6 text-stone-800 shadow-sm ${message.tone}`}>
                            <div className="mb-1 text-xs font-semibold text-stone-500">{message.name}</div>
                            {message.text}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-stone-200 bg-white p-4">
                      <div className="flex items-center gap-3 rounded-md border border-stone-200 bg-[#fbfaf7] px-4 py-3 text-sm text-stone-500">
                        Write a message
                        <span className="ml-auto text-blue-600">Send</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
