import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Copy,
  Eye,
  KeyRound,
  LogIn,
  MoreHorizontal,
  Pencil,
  PauseCircle,
  PlayCircle,
  CreditCard,
  Package,
  Trash2,
} from "lucide-react";
import { startImpersonation } from "@/lib/admin/impersonation";
import type { SchoolRow } from "@/lib/admin/queries";

export function SchoolActions({
  school,
  plans,
}: {
  school: SchoolRow;
  plans: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planId, setPlanId] = useState(school.plan_id ?? "");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-schools-full"] });
    qc.invalidateQueries({ queryKey: ["admin-schools"] });
  };

  async function setStatus(status: "active" | "suspended") {
    const { error } = await supabase
      .from("schools")
      .update({ subscription_status: status })
      .eq("id", school.id);
    if (error) return toast.error(error.message);
    toast.success(status === "active" ? "Escola reativada" : "Escola suspensa");
    refresh();
  }

  async function changePlan() {
    const { error } = await supabase
      .from("schools")
      .update({ plan_id: planId || null })
      .eq("id", school.id);
    if (error) return toast.error(error.message);
    toast.success("Plano atualizado");
    setPlanOpen(false);
    refresh();
  }

  async function remove() {
    const { error } = await supabase.from("schools").delete().eq("id", school.id);
    if (error) return toast.error(error.message);
    toast.success("Escola excluída");
    setConfirmDelete(false);
    refresh();
  }

  async function duplicate() {
    const { error } = await supabase.from("schools").insert({
      name: `${school.name} (cópia)`,
      slug: `${school.slug}-copia-${Math.random().toString(36).slice(2, 6)}`,
      city: school.city,
      state: school.state,
      plan_id: school.plan_id,
    });
    if (error) return toast.error(error.message);
    toast.success("Escola duplicada");
    refresh();
  }

  async function resetPassword() {
    if (!school.ownerEmail) return toast.error("Escola sem responsável com e-mail cadastrado");
    const { error } = await supabase.auth.resetPasswordForEmail(school.ownerEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) return toast.error(error.message);
    toast.success(`Link de redefinição enviado para ${school.ownerEmail}`);
  }

  function impersonate() {
    startImpersonation({ schoolId: school.id, schoolName: school.name });
    qc.invalidateQueries();
    toast.success(`Modo administrador: ${school.name}`);
    navigate({ to: "/app/school" });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            aria-label={`Ações de ${school.name}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 rounded-2xl">
          <DropdownMenuLabel className="truncate">{school.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/app/admin/schools/$id" params={{ id: school.id }}>
              <Eye className="size-4" /> Visualizar
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              to="/app/admin/schools/$id"
              params={{ id: school.id }}
              search={{ tab: "settings" }}
            >
              <Pencil className="size-4" /> Editar
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={impersonate}>
            <LogIn className="size-4" /> Entrar como administrador
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              to="/app/admin/schools/$id"
              params={{ id: school.id }}
              search={{ tab: "subscription" }}
            >
              <CreditCard className="size-4" /> Gerenciar assinatura
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPlanOpen(true)}>
            <Package className="size-4" /> Trocar plano
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={resetPassword}>
            <KeyRound className="size-4" /> Resetar senha
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {school.subscription_status === "suspended" ? (
            <DropdownMenuItem onSelect={() => setStatus("active")}>
              <PlayCircle className="size-4" /> Reativar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setStatus("suspended")}>
              <PauseCircle className="size-4" /> Suspender
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={duplicate}>
            <Copy className="size-4" /> Duplicar
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trocar plano — {school.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Plano</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button className="rounded-xl" onClick={changePlan}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {school.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove a escola e todos os dados vinculados. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={remove}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
