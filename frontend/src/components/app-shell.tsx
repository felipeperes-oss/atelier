import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Calendar, Users, User, FileText, BookOpen, Bell, NotebookPen, LogOut, Menu, Mail, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ProfileDialog } from "@/components/profile-dialog";

const items = [
  { to: "/painel", label: "Calendário", icon: Calendar },
  { to: "/grupo", label: "Trabalho em grupo", icon: Users },
  { to: "/individual", label: "Trabalho individual", icon: User },
  { to: "/anotacoes-gerais", label: "Anotações gerais", icon: FileText },
  { to: "/anotacoes-individuais", label: "Anotações individuais", icon: NotebookPen },
  { to: "/tutoriais", label: "Tutoriais", icon: BookOpen },
  { to: "/alertas", label: "Alertas", icon: Bell },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  async function handleSignOut() {
    signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform lg:translate-x-0 lg:static",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="px-6 py-8 border-b border-sidebar-border">
          <div className="font-display text-2xl tracking-wide text-sidebar-foreground">Atelier</div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-1">Gestão da equipe</div>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          {user && (
            <div className="mb-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                    {user.display_name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? "")
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground">
                    <UserRound className="h-4 w-4 text-sidebar-foreground/70" />
                    <span className="truncate">{user.display_name}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{user.email}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <ProfileDialog user={user} />
          <Button variant="destructive" className="w-full justify-start" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden h-14 border-b border-border flex items-center px-4 bg-card">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="font-display text-xl ml-3">Atelier</div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
