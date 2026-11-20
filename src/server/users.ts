import { db } from "@/db";
import { users } from "@/db/schema";

/** The member's own record, made the first time the app sees them. */
export async function ensureUser(user: { id: string; email: string }) {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email, createdAt: Date.now() })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email } });
}
