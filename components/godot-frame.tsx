import { buildGodotFrameSrc } from "@/lib/pets";

export function GodotFrame({
  pet,
}: {
  pet: { pet_type: string; level: number } | null;
}) {
  const src = buildGodotFrameSrc(pet);
  return (
    <section className="monitor" aria-label="Desktop">
      <div className="monitor-caption">
        <span>Desktop</span>
        <span className="monitor-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
      <iframe
        key={src}
        className="godot-frame"
        src={src}
        title="Godot desktop pet"
        allow="autoplay; fullscreen"
      />
    </section>
  );
}
