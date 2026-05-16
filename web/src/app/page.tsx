import { redirect } from "next/navigation";

/**
 * The app has no public landing page. Send visitors to the dashboard; the
 * AuthGuard there forwards unauthenticated users on to /login.
 */
export default function Home() {
  redirect("/dashboard");
}
