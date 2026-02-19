import AuthForm from "@/components/auth/AuthForm";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-md p-4">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          Digital Tambyan
        </h1>
        <AuthForm />
      </div>
    </main>
  );
}