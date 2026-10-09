import { sessionName } from "@/lib/auth";
import Desk from "./desk";
import Login from "./login";

export const dynamic = "force-dynamic";

export default async function Home() {
  const name = await sessionName();
  return name ? <Desk account={name} /> : <Login />;
}
