import { db } from "@/db";
import { users } from "@/db/schema";

export interface Member {
  id: string;
  email: string;
  orgId: string;
  orgRole: string;
}

/** Records the member the first time they open the app; their email follows the Gateway's. */
export async function ensureMember(user: Member): Promise<void> {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email, orgId: user.orgId })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email, orgId: user.orgId } });
}
