import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { signIn, signUp } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar - Atelier" }] }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail invalido").max(255),
  password: z.string().min(6, "Minimo 6 caracteres").max(72),
  displayName: z.string().trim().min(1).max(80).optional(),
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/painel", replace: true });
  }, [user, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, displayName: mode === "signup" ? displayName : undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUp(email, password, displayName);
        toast.success("Conta criada");
      } else {
        await signIn(email, password);
      }
      navigate({ to: "/painel", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-accent/40">
        <div className="font-display text-2xl tracking-wide">Atelier</div>
        <div className="max-w-md">
          <h1 className="font-display text-5xl leading-tight text-foreground">
            A serenidade de saber o que <em className="italic">vem pela frente</em>.
          </h1>
          <p className="mt-4 text-muted-foreground">
            Calendario, tarefas, anotacoes e alertas em um unico espaco pensado para a sua equipe.
          </p>
        </div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trabalho em harmonia</div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <Card className="w-full max-w-md p-8">
          <h2 className="font-display text-3xl text-foreground">
            {mode === "signin" ? "Bem-vindo de volta" : "Criar conta"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Entre para acessar o painel da equipe." : "Cadastre-se em poucos segundos."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Seu nome" maxLength={80} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" maxLength={255} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" minLength={6} maxLength={72} required />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <button
            type="button"
            className="mt-6 text-sm text-muted-foreground hover:text-foreground transition"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Nao tem conta? Cadastre-se" : "Ja tem conta? Entrar"}
          </button>
          <p className="mt-4 text-xs text-muted-foreground">
            Usuario de teste: felipe@atelier.local / 123456
          </p>
        </Card>
      </div>
    </div>
  );
}
