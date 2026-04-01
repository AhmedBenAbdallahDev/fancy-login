"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "lib/utils";
import { StylePreset, DEFAULT_STYLE_PRESETS } from "app-types/style-preset";
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
import {
  Plus,
  Edit,
  Trash2,
  Star,
  Palette,
  Copy,
  Loader,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function StylePresetsPage() {
  const t = useTranslations("StylePreset");
  const tCommon = useTranslations("Common");
  const { data, isLoading } = useSWR<{
    presets: StylePreset[];
    templates: typeof DEFAULT_STYLE_PRESETS;
  }>("/api/style-preset", fetcher);
  const presets = data?.presets || [];
  const templates = data?.templates || DEFAULT_STYLE_PRESETS;

  const [isCreating, setIsCreating] = useState(false);
  const [editingPreset, setEditingPreset] = useState<StylePreset | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    isDefault: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      systemPrompt: "",
      isDefault: false,
    });
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.systemPrompt.trim()) {
      toast.error(t("nameRequired"));
      return;
    }

    setIsSaving(true);
    try {
      await fetcher("/api/style-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      toast.success(t("styleCreated"));
      mutate("/api/style-preset");
      setIsCreating(false);
      resetForm();
    } catch (_error) {
      toast.error(t("failedToCreate"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingPreset || !formData.name.trim()) return;

    setIsSaving(true);
    try {
      await fetcher(`/api/style-preset/${editingPreset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      toast.success(t("styleUpdated"));
      mutate("/api/style-preset");
      setEditingPreset(null);
      resetForm();
    } catch (_error) {
      toast.error(t("failedToUpdate"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetcher(`/api/style-preset/${id}`, { method: "DELETE" });
      toast.success(t("styleDeleted"));
      mutate("/api/style-preset");
    } catch (_error) {
      toast.error(t("failedToDelete"));
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await fetcher(`/api/style-preset/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      toast.success(t("defaultUpdated"));
      mutate("/api/style-preset");
    } catch (_error) {
      toast.error(t("failedToSetDefault"));
    }
  };

  const handleUseTemplate = (template: (typeof DEFAULT_STYLE_PRESETS)[0]) => {
    setFormData({
      name: template.name,
      description: template.description || "",
      systemPrompt: template.systemPrompt,
      isDefault: presets.length === 0, // First one is default
    });
    setIsCreating(true);
  };

  const openEditDialog = (preset: StylePreset) => {
    setFormData({
      name: preset.name,
      description: preset.description || "",
      systemPrompt: preset.systemPrompt,
      isDefault: preset.isDefault,
    });
    setEditingPreset(preset);
  };

  return (
    <ScrollArea className="h-full w-full">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Palette className="size-6 text-primary" />
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
                  {t("newStyle")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t("createTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("createDescription")}
                  </DialogDescription>
                </DialogHeader>
                <StyleForm
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

        {/* Templates Section */}
        {presets.length === 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="size-5" />
              Quick Start Templates
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((template, index) => (
                <Card
                  key={index}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleUseTemplate(template)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      {template.name}
                      <Button variant="ghost" size="sm">
                        <Copy className="size-4 mr-1" />
                        Use
                      </Button>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* User's Styles */}
        <div>
          <h2 className="text-lg font-semibold mb-4">
            {presets.length > 0 ? "My Styles" : ""}
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : presets.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Palette className="size-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t("noStyles")}</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {t("noStylesDescription")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {presets.map((preset) => (
                <Card key={preset.id} className="group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {preset.name}
                          {preset.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="size-3 mr-1 fill-current" />
                              {t("defaultStyle")}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {preset.description || tCommon("description")}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Dialog
                          open={editingPreset?.id === preset.id}
                          onOpenChange={(open) =>
                            !open && setEditingPreset(null)
                          }
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(preset)}
                            >
                              <Edit className="size-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>{t("editTitle")}</DialogTitle>
                              <DialogDescription>
                                {t("editDescription")}
                              </DialogDescription>
                            </DialogHeader>
                            <StyleForm
                              formData={formData}
                              setFormData={setFormData}
                              isSaving={isSaving}
                              onSubmit={handleUpdate}
                              submitLabel={t("updateButton")}
                              t={t}
                            />
                          </DialogContent>
                        </Dialog>

                        {!preset.isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetDefault(preset.id)}
                          >
                            <Star className="size-4" />
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
                                onClick={() => handleDelete(preset.id)}
                              >
                                {tCommon("delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs text-muted-foreground bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap max-h-32">
                      {preset.systemPrompt}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

function StyleForm({
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
    systemPrompt: string;
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
        <Label htmlFor="systemPrompt">{t("promptLabel")} *</Label>
        <Textarea
          id="systemPrompt"
          placeholder={t("promptPlaceholder")}
          className="min-h-48 font-mono text-sm"
          value={formData.systemPrompt}
          onChange={(e) =>
            setFormData({ ...formData, systemPrompt: e.target.value })
          }
        />
        <p className="text-xs text-muted-foreground">{t("promptHelp")}</p>
      </div>

      <Button onClick={onSubmit} disabled={isSaving} className="w-full">
        {isSaving && <Loader className="size-4 animate-spin mr-2" />}
        {submitLabel}
      </Button>
    </div>
  );
}
