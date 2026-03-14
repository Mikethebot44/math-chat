"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { SettingsPageContent } from "@/components/settings/settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  emptyUserPreferences,
  normalizeAssistantTraits,
  normalizeUserPreferences,
  SUGGESTED_ASSISTANT_TRAITS,
  USER_PREFERENCE_LIMITS,
  type UserPreferences,
} from "@/lib/settings/user-preferences";
import { useTRPC } from "@/trpc/react";

function countLabel(current: number, max: number) {
  return `${current}/${max}`;
}

export function GeneralSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const hydratedRef = useRef(false);

  const [form, setForm] = useState<UserPreferences>(emptyUserPreferences);
  const [traitInput, setTraitInput] = useState("");

  const preferencesQuery = useQuery(
    trpc.settings.getGeneralPreferences.queryOptions()
  );

  useEffect(() => {
    if (!preferencesQuery.data || hydratedRef.current) {
      return;
    }

    setForm(preferencesQuery.data);
    hydratedRef.current = true;
  }, [preferencesQuery.data]);

  const normalizedForm = useMemo(() => normalizeUserPreferences(form), [form]);
  const savedPreferences = preferencesQuery.data ?? emptyUserPreferences;
  const isDirty =
    JSON.stringify(normalizedForm) !== JSON.stringify(savedPreferences);

  const savePreferencesMutation = useMutation(
    trpc.settings.updateGeneralPreferences.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Failed to save preferences");
      },
      onSuccess: (preferences) => {
        queryClient.setQueryData(
          trpc.settings.getGeneralPreferences.queryKey(),
          preferences
        );
        setForm(preferences);
        setTraitInput("");
        toast.success("Preferences saved");
      },
    })
  );

  function updateField<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function addTrait(rawTrait: string) {
    const nextTraits = normalizeAssistantTraits([
      ...normalizedForm.assistantTraits,
      rawTrait,
    ]);

    if (nextTraits.length === normalizedForm.assistantTraits.length) {
      setTraitInput("");
      return;
    }

    updateField("assistantTraits", nextTraits);
    setTraitInput("");
  }

  function removeTrait(trait: string) {
    updateField(
      "assistantTraits",
      normalizedForm.assistantTraits.filter((value) => value !== trait)
    );
  }

  function handleTraitKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== "Tab") {
      return;
    }

    const trimmed = traitInput.trim();
    if (!trimmed) {
      return;
    }

    event.preventDefault();
    addTrait(trimmed);
  }

  async function handleSave() {
    await savePreferencesMutation.mutateAsync(normalizedForm);
  }

  const availableSuggestions = SUGGESTED_ASSISTANT_TRAITS.filter(
    (trait) => !normalizedForm.assistantTraits.includes(trait)
  );

  return (
    <SettingsPageContent className="gap-6">
      <div className="max-w-3xl space-y-2">
        <h2 className="font-semibold text-lg">General</h2>
        <p className="text-muted-foreground text-sm">
          Save a few personal preferences so the assistant can adapt tone,
          naming, and explanation style across chats.
        </p>
      </div>

      <section className="max-w-3xl rounded-2xl border border-border/70 bg-background p-5 shadow-xs sm:p-6">
        <div className="space-y-8">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="preferred-name">What should the assistant call you?</Label>
              <span className="text-muted-foreground text-xs">
                {countLabel(
                  form.preferredName.length,
                  USER_PREFERENCE_LIMITS.preferredName
                )}
              </span>
            </div>
            <Input
              disabled={preferencesQuery.isLoading}
              id="preferred-name"
              maxLength={USER_PREFERENCE_LIMITS.preferredName}
              onChange={(event) => updateField("preferredName", event.target.value)}
              placeholder="Your name"
              value={form.preferredName}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="occupation">What do you do?</Label>
              <span className="text-muted-foreground text-xs">
                {countLabel(
                  form.occupation.length,
                  USER_PREFERENCE_LIMITS.occupation
                )}
              </span>
            </div>
            <Input
              disabled={preferencesQuery.isLoading}
              id="occupation"
              maxLength={USER_PREFERENCE_LIMITS.occupation}
              onChange={(event) => updateField("occupation", event.target.value)}
              placeholder="Student, researcher, engineer..."
              value={form.occupation}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="assistant-traits">
                What traits should the assistant have?
              </Label>
              <span className="text-muted-foreground text-xs">
                {countLabel(
                  normalizedForm.assistantTraits.length,
                  USER_PREFERENCE_LIMITS.assistantTraitCount
                )}
              </span>
            </div>

            {normalizedForm.assistantTraits.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {normalizedForm.assistantTraits.map((trait) => (
                  <Badge
                    className="gap-1 rounded-full border-border bg-secondary/60 px-3 py-1 font-medium text-xs"
                    key={trait}
                    variant="outline"
                  >
                    {trait}
                    <button
                      aria-label={`Remove ${trait}`}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => removeTrait(trait)}
                      type="button"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="relative">
              <Input
                disabled={
                  preferencesQuery.isLoading ||
                  normalizedForm.assistantTraits.length >=
                    USER_PREFERENCE_LIMITS.assistantTraitCount
                }
                id="assistant-traits"
                maxLength={USER_PREFERENCE_LIMITS.assistantTrait}
                onChange={(event) => setTraitInput(event.target.value)}
                onKeyDown={handleTraitKeyDown}
                placeholder="Type a trait and press Enter"
                value={traitInput}
              />
              <Button
                className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
                disabled={!traitInput.trim()}
                onClick={() => addTrait(traitInput)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Plus className="size-3.5" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {availableSuggestions.map((trait) => (
                <button
                  className={cn(
                    "inline-flex items-center rounded-full border border-border px-3 py-1 text-muted-foreground text-xs transition-colors hover:border-foreground/20 hover:text-foreground"
                  )}
                  key={trait}
                  onClick={() => addTrait(trait)}
                  type="button"
                >
                  {trait}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="additional-context">
                Anything else the assistant should know about you?
              </Label>
              <span className="text-muted-foreground text-xs">
                {countLabel(
                  form.additionalContext.length,
                  USER_PREFERENCE_LIMITS.additionalContext
                )}
              </span>
            </div>
            <Textarea
              className="min-h-40 resize-y"
              disabled={preferencesQuery.isLoading}
              id="additional-context"
              maxLength={USER_PREFERENCE_LIMITS.additionalContext}
              onChange={(event) =>
                updateField("additionalContext", event.target.value)
              }
              placeholder="Interests, values, learning preferences, or context worth keeping in mind."
              value={form.additionalContext}
            />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3 border-border/60 border-t pt-5">
          <p className="text-muted-foreground text-sm">
            {preferencesQuery.isLoading
              ? "Loading your saved preferences..."
              : isDirty
                ? "Unsaved changes"
                : "Changes are saved"}
          </p>
          <Button
            disabled={
              preferencesQuery.isLoading ||
              savePreferencesMutation.isPending ||
              !isDirty
            }
            onClick={handleSave}
            type="button"
          >
            {savePreferencesMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving
              </>
            ) : (
              "Save preferences"
            )}
          </Button>
        </div>
      </section>
    </SettingsPageContent>
  );
}
