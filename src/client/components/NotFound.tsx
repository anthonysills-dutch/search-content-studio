import { Link } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { Button } from "@/client/components/ui/button";

export function NotFound() {
  return (
    <AppShell>
      <div data-testid="not-found">
        <EmptyState kind="filtered" title="Not found" description="It was deleted, or it isn't yours." action={<Button render={<Link to="/" />}>Go to documents</Button>} />
      </div>
    </AppShell>
  );
}
