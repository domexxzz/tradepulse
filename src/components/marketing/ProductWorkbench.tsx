import { ConfigurationShowcase } from "./ConfigurationShowcase";
import { ProductConfidence } from "./ProductConfidence";

export function ProductWorkbench() {
  return (
    <section id="workbench" className="border-y border-border bg-background/55 section">
      <div className="container-x">
        <ConfigurationShowcase />
        <ProductConfidence />
      </div>
    </section>
  );
}
