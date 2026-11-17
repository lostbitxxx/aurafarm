"use client";

import { PixelPetArt } from "./pixel-pet";

export function TrackerDemo({ kind }: { kind: "desktop" | "website" }) {
  if (kind === "website") {
    return (
      <div className="tracker-demo" aria-hidden="true">
        <div className="demo-browser">
          <div className="demo-chrome">
            <i />
            <i />
            <i />
            <span>Desk</span>
          </div>
          <div className="demo-stage">
            <div className="demo-clock">
              <span>30:00</span>
              <span>22:10</span>
              <span>11:05</span>
              <span>00:00</span>
            </div>
            <PixelPetArt
              petType="baby_slime"
              pose="study1"
              color="lavender"
              className="demo-study-pet"
              alt=""
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tracker-demo" aria-hidden="true">
      <div className="demo-os">
        <div className="demo-menubar" />
        <div className="demo-window">
          <span />
          <span />
          <span />
        </div>
        <span className="demo-farm">FARM AURA</span>
        <span className="demo-cursor" />
        <span className="demo-walker">
          <PixelPetArt petType="baby_slime" pose="walk1" color="lavender" className="demo-walk-frame" alt="" />
          <PixelPetArt
            petType="baby_slime"
            pose="walk2"
            color="lavender"
            className="demo-walk-frame is-step"
            alt=""
          />
        </span>
      </div>
    </div>
  );
}
