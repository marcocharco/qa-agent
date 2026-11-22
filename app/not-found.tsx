import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-3 text-muted">That Trail or check is not in the database. <Link href="/" className="text-accent hover:underline">Back to the Trails</Link></p>
    </main>
  );
}
