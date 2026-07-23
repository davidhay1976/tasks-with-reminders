export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-md px-6 py-16 text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Day 1 scaffold
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Tasks with Reminders
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          A shared checklist for moving out. Onboarding, tasks, and reminders
          land next.
        </p>
      </main>
    </div>
  );
}
