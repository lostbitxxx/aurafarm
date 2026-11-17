"use client";

import { PixelPetArt } from "./pixel-pet";

function DemoChrome({ label, titles }: { label?: string; titles?: boolean }) {
  return (
    <div className="demo-chrome">
      <i />
      <i />
      <i />
      {titles ? (
        <>
          <span className="demo-title is-home">Aurafarm</span>
          <span className="demo-title is-pdf">Notes.pdf</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
}

function DemoPet({ pose = "idle" }: { pose?: "idle" | "walk1" | "walk2" | "blush" }) {
  return <PixelPetArt petType="baby_slime" pose={pose} color="lavender" className="demo-pet-frame" alt="" />;
}

function DemoPdf() {
  return (
    <div className="demo-pdf" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function DemoReward() {
  return (
    <div className="demo-reward">
      <DemoPet pose="blush" />
      <strong>Time&apos;s up</strong>
      <span>+72 XP</span>
    </div>
  );
}

function DemoChoose({ side }: { side: "left" | "right" }) {
  const desktop = side === "left";
  return (
    <div className="demo-choose">
      <p>Start session</p>
      <div className="demo-picks">
        {desktop ? <b>Desktop pet</b> : <span>Desktop pet</span>}
        {desktop ? <span>Online timer</span> : <b>Online timer</b>}
      </div>
      <i className={desktop ? "demo-cursor is-left" : "demo-cursor is-right"} />
    </div>
  );
}

export function TrackerDemo({ kind }: { kind: "desktop" | "website" }) {
  if (kind === "website") {
    return (
      <div className="tracker-demo" aria-hidden="true">
        <div className="demo-play demo-play-web">
          <div className="demo-screen demo-pdf-window">
            <DemoChrome label="Notes.pdf" />
            <div className="demo-body">
              <DemoPdf />
            </div>
          </div>
          <div className="demo-screen demo-main-window">
            <DemoChrome label="Aurafarm" />
            <div className="demo-body">
              <DemoChoose side="right" />
              <p className="demo-clock demo-clock-a">30:00</p>
              <p className="demo-clock demo-clock-b">24:20</p>
              <p className="demo-clock demo-clock-c">18:40</p>
              <DemoReward />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tracker-demo" aria-hidden="true">
      <div className="demo-play demo-play-desk">
        <div className="demo-screen">
          <DemoChrome titles />
          <div className="demo-body">
            <DemoChoose side="left" />
            <div className="demo-pdf-layer">
              <DemoPdf />
            </div>
            <div className="demo-youtube">
              <span className="demo-play-mark" />
              <em>YouTube</em>
              <i className="demo-x" />
            </div>
            <span className="demo-pet">
              <DemoPet />
              <DemoPet pose="walk1" />
              <DemoPet pose="walk2" />
            </span>
            <DemoReward />
          </div>
        </div>
      </div>
    </div>
  );
}
