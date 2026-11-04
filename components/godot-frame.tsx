export function GodotFrame() {
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
        className="godot-frame"
        src="/godot-game/index.html"
        title="Godot desktop pet"
        allow="autoplay; fullscreen"
      />
    </section>
  );
}
