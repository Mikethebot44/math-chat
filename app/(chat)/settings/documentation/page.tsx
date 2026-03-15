import { ApiDocumentationSettings } from "@/components/settings/api-settings";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";

export default function DocumentationSettingsPage() {
  return (
    <SettingsPage>
      <SettingsPageHeader>
        <h2 className="font-semibold text-lg">Documentation</h2>
        <p className="text-muted-foreground text-sm">
          Use these curl examples to create and poll completions with your
          account API key.
        </p>
      </SettingsPageHeader>
      <ApiDocumentationSettings />
    </SettingsPage>
  );
}
