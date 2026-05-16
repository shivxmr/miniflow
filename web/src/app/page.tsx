export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10 text-neutral-950">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-6">
          <div>
            <p className="text-sm font-medium text-emerald-700">MiniFlow</p>
            <h1 className="mt-2 text-3xl font-semibold">Project workspace scaffold</h1>
          </div>
          <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600">
            Step 1 ready
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {["Dashboard", "Projects", "Task board"].map((item) => (
            <div key={item} className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="text-lg font-medium">{item}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Placeholder surface for the upcoming authenticated product workflow.
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
