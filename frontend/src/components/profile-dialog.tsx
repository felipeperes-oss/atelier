import { useEffect, useState } from "react";
import { Mail, PencilLine, UserRound, KeyRound } from "lucide-react";
import { api, type AppUser } from "@/lib/api";
import { setStoredUser } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ProfileDialogProps = {
  user: AppUser | null;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProfileDialog({ user }: ProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.display_name);
    setEmail(user.email);
    setPassword("");
    setConfirmPassword("");
  }, [user, open]);

  if (!user) return null;

  async function handleSave() {
    const nextDisplayName = displayName.trim();
    const nextEmail = email.trim().toLowerCase();
    const nextPassword = password.trim();

    if (!nextDisplayName) {
      toast.error("Informe um nome.");
      return;
    }
    if (!nextEmail || !nextEmail.includes("@")) {
      toast.error("Informe um e-mail valido.");
      return;
    }
    if ((nextPassword || confirmPassword.trim()) && nextPassword.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (nextPassword !== confirmPassword.trim()) {
      toast.error("A confirmacao de senha nao confere.");
      return;
    }

    setSaving(true);
    try {
      const { user: updatedUser } = await api.profiles.update(user.id, {
        display_name: nextDisplayName,
        email: nextEmail,
        password: nextPassword || undefined,
      });
      setStoredUser(updatedUser);
      toast.success("Perfil atualizado");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          <PencilLine className="h-4 w-4" />
          Editar perfil
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Seu perfil</DialogTitle>
          <DialogDescription>Atualize nome, e-mail e senha da conta conectada.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials(displayName || user.display_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{displayName || user.display_name}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="truncate">{email || user.email}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nome</Label>
            <Input
              id="profile-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-email">E-mail</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-password">Nova senha</Label>
            <Input
              id="profile-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Deixe em branco para manter"
              minLength={6}
              maxLength={72}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-password-confirm">Confirmar senha</Label>
            <Input
              id="profile-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              minLength={6}
              maxLength={72}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>
            <KeyRound className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar alteracoes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
