"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "lib/utils";
import { Persona } from "app-types/persona";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { Textarea } from "ui/textarea";
import { Label } from "ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { Badge } from "ui/badge";
import { ScrollArea } from "ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "ui/dialog";
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
} from "ui/alert-dialog";
import { Plus, Edit, Trash2, Star, User, Loader } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function PersonaPage() {
  const t = useTranslations("Persona");
  const tCommon = useTranslations("Common");
  const { data: personas, isLoading } = useSWR<Persona[]>(
    "/api/persona",
    fetcher,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    personality: "",
    avatar: "",
    isDefault: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      personality: "",
      avatar: "",
      isDefault: false,
    });
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }

    setIsSaving(true);
    try {
      await fetcher("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      toast.success(t("personaCreated"));
      mutate("/api/persona");
      setIsCreating(false);
      resetForm();
    } catch (_error) {
      toast.error(t("failedToCreate"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingPersona || !formData.name.trim()) return;

    setIsSaving(true);
    try {
      await fetcher(`/api/persona/${editingPersona.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      toast.success(t("personaUpdated"));
      mutate("/api/persona");
      setEditingPersona(null);
      resetForm();
    } catch (_error) {
      toast.error(t("failedToUpdate"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetcher(`/api/persona/${id}`, { method: "DELETE" });
      toast.success(t("personaDeleted"));
      mutate("/api/persona");
    } catch (_error) {
      toast.error(t("failedToDelete"));
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await fetcher(`/api/persona/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      toast.success(t("defaultUpdated"));
      mutate("/api/persona");
    } catch (_error) {
      toast.error(t("failedToSetDefault"));
    }
  };

  const openEditDialog = (persona: Persona) => {
    setFormData({
      name: persona.name,
      description: persona.description || "",
      personality: persona.personality || "",
      avatar: persona.avatar || "",
      isDefault: persona.isDefault,
    });
    setEditingPersona(persona);
  };

  return (
    <ScrollArea className="h-full w-full">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="size-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{t("title")}</h1>
                <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
              </div>
            </div>

            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    resetForm();
                    setIsCreating(true);
                  }}
                >
                  <Plus className="size-4 mr-2" />
                  {t("newPersona")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("createTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("createDescription")}
                  </DialogDescription>
                </DialogHeader>
                <PersonaForm
                  formData={formData}
                  setFormData={setFormData}
                  isSaving={isSaving}
                  onSubmit={handleCreate}
                  submitLabel={t("createButton")}
                  t={t}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Personas List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : personas?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <User className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t("noPersonas")}</h3>
              <p className="text-muted-foreground text-center mb-4">
                {t("noPersonasDescription")}
              </p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="size-4 mr-2" />
                {t("newPersona")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {personas?.map((persona) => (
              <Card
                key={persona.id}
                className="group hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-12">
                        <AvatarImage src={persona.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {persona.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {persona.name}
                          {persona.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="size-3 mr-1 fill-current" />
                              {t("defaultPersona")}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="line-clamp-1">
                          {persona.description || tCommon("description")}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {persona.personality && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {persona.personality}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Dialog
                      open={editingPersona?.id === persona.id}
                      onOpenChange={(open) => !open && setEditingPersona(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(persona)}
                        >
                          <Edit className="size-4 mr-1" />
                          {tCommon("edit")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("editTitle")}</DialogTitle>
                          <DialogDescription>
                            {t("editDescription")}
                          </DialogDescription>
                        </DialogHeader>
                        <PersonaForm
                          formData={formData}
                          setFormData={setFormData}
                          isSaving={isSaving}
                          onSubmit={handleUpdate}
                          submitLabel={t("updateButton")}
                          t={t}
                        />
                      </DialogContent>
                    </Dialog>

                    {!persona.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(persona.id)}
                      >
                        <Star className="size-4 mr-1" />
                        {t("setAsDefault")}
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("deleteTitle")}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("deleteDescription")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {tCommon("cancel")}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(persona.id)}
                          >
                            {tCommon("delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function PersonaForm({
  formData,
  setFormData,
  isSaving,
  onSubmit,
  submitLabel,
  t,
}: {
  formData: {
    name: string;
    description: string;
    personality: string;
    avatar: string;
    isDefault: boolean;
  };
  setFormData: (data: any) => void;
  isSaving: boolean;
  onSubmit: () => void;
  submitLabel: string;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t("nameLabel")} *</Label>
        <Input
          id="name"
          placeholder={t("namePlaceholder")}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t("descriptionLabel")}</Label>
        <Input
          id="description"
          placeholder={t("descriptionPlaceholder")}
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="personality">{t("personalityLabel")}</Label>
        <Textarea
          id="personality"
          placeholder={t("personalityPlaceholder")}
          className="min-h-32"
          value={formData.personality}
          onChange={(e) =>
            setFormData({ ...formData, personality: e.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="avatar">{t("avatarLabel")}</Label>
        <Input
          id="avatar"
          placeholder={t("avatarPlaceholder")}
          value={formData.avatar}
          onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
        />
      </div>

      <Button onClick={onSubmit} disabled={isSaving} className="w-full">
        {isSaving && <Loader className="size-4 animate-spin mr-2" />}
        {submitLabel}
      </Button>
    </div>
  );
}
