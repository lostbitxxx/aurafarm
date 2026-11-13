import type { Metadata } from "next";
import { CustomizeWizard } from "@/components/customize-wizard";
import { PublicHeader } from "@/components/public-header";
import { loadCustomizationGate } from "@/lib/customization";

export const metadata: Metadata = {
  title: "Choose your study mode",
};

export const instant = false;

export default async function CustomizePage() {
  const gate = await loadCustomizationGate();
  return (
    <div className="desk-page customize-page">
      <PublicHeader account={{ displayName: gate.displayName }} />
      <main className="customize-layout">
        <CustomizeWizard
          displayName={gate.displayName}
          migrationError={gate.error}
          initialPlan={gate.plan}
        />
      </main>
    </div>
  );
}
