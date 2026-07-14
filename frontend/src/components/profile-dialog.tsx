import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Mail, PencilLine, UserRound, KeyRound } from "lucide-react";
import { api, API_BASE, type AppUser } from "@/lib/api";
import { setStoredUser } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.display_name);
    setEmail(user.email);
    setPassword("");
    setConfirmPassword("");
    setSelectedPhoto(null);
  }, [user, open]);

  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedPhoto);
    setPhotoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedPhoto]);

  if (!user) return null;

  async function handleSave() {
    if (!user) return;
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
    if (selectedPhoto && !selectedPhoto.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (selectedPhoto && selectedPhoto.size > 5 * 1024 * 1024) {
      toast.error("A foto precisa ter ate 5 MB.");
      return;
    }

    setSaving(true);
    try {
      let updatedUser = (
        await api.profiles.update(user.id, {
          display_name: nextDisplayName,
          email: nextEmail,
          password: nextPassword || undefined,
        })
      ).user;
      if (selectedPhoto) {
        updatedUser = (await api.profiles.updatePhoto(user.id, selectedPhoto)).user;
      }
      setStoredUser(updatedUser);
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Perfil atualizado");
      setSelectedPhoto(null);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  }

  const photoUrl = photoPreviewUrl ?? (user.photo_url ? `${API_BASE}${user.photo_url}` : null);

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
            {photoUrl && <AvatarImage src={photoUrl} alt={displayName || user.display_name} className="object-cover" />}
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
          <label className="ml-auto inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-input bg-background hover:bg-accent">
            <Camera className="h-4 w-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => setSelectedPhoto(event.target.files?.[0] ?? null)}
            />
          </label>
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={saving}>
                <KeyRound className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar alteracoes"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Salvar alteracoes?</AlertDialogTitle>
                <AlertDialogDescription>
                  As informacoes do seu perfil serao atualizadas para os novos dados preenchidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleSave} disabled={saving}>
                  Salvar alteracoes
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
