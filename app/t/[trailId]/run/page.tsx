import { redirect } from "next/navigation";

// The run view is the Trail's home now. Old links keep working.
export default async function RunRedirect({ params }: { params: Promise<{ trailId: string }> }) {
  redirect(`/t/${(await params).trailId}`);
}
