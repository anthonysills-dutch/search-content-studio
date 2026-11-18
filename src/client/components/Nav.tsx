import { Link } from "@tanstack/react-router";

const LINKS = [
  { to: "/", label: "Documents", exact: true },
  { to: "/briefs", label: "Briefs" },
  { to: "/sites", label: "Sites" },
  { to: "/voices", label: "Voices" },
  { to: "/settings", label: "Settings" },
] as const;

export function Nav() {
  return (
    <nav className="flex items-center gap-3 text-sm">
      {LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          activeOptions={{ exact: "exact" in link }}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
