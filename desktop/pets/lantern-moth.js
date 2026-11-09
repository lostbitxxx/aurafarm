export function drawLanternMoth(context) {
  context.fillStyle = "rgba(8, 16, 12, 0.28)";
  context.beginPath();
  context.ellipse(64, 106, 28, 6, 0, 0, Math.PI * 2);
  context.fill();

  const palette = {
    "#": "#3a281c",
    Y: "#f4c968",
    W: "#e39a45",
    d: "#c47a2c",
    D: "#9e5e28",
    o: "#fff1ce",
    O: "#7a4824",
    B: "#f6e4c4",
    C: "#fff7e6",
    P: "#2a1e16",
    H: "#ffffff",
    A: "#5c402c",
    L: "#ffd678",
    l: "#fff4c8",
    F: "#5c3c28",
  };
  const rows = [
    "..........##.......##...........",
    ".........#LL#.....#LL#..........",
    ".........#lL#.....#lL#..........",
    "..........##.......##...........",
    "..........#A#......#A#..........",
    "..........#A#......#A#..........",
    "..........#A#......#A#..........",
    "..........#A#......#A#..........",
    "....#######A#.####.#A#######....",
    "...#YYYYYYYA##BBBB##AYYYYYYY#...",
    "..#YYYYYYYYYBBBBBBBBYYYYYYYYY#..",
    ".#YYYYYYYYYBBBBBBBBBBYYYYYYYYY#.",
    "#YYYYYooYYYBBBBBBBBBBYYYooYYYYY#",
    "#YYYYooOoYBBHBBBBBHBBBYoOooYYYY#",
    "#YYYYoOOoYBBPPBBBBPPBBYoOOoYYYY#",
    "#WWWWWoooWBBBBBBBBBBBBWoooWWWWW#",
    "#WWWWWWWWWBBBCCCCCCBBBWWWWWWWWW#",
    ".#WWWWWWdddBBCCCCCCBBdddWWWWWW#.",
    "..#WWWdddddBCCCCCCCCBdddddWWW#..",
    "...##dddddddBCCCCCCBddddddd##...",
    "....#ddDDDDDDBCCCCBDDDDDDdd#....",
    ".....#dDDDDDDddBBddDDDDDDd#.....",
    "......#ddDDDd#F##F#dDDDdd#......",
    ".......#######F##F#######.......",
    ".............#F##F#.............",
    "..............#..#..............",
  ];
  const scale = 3;
  const originX = Math.floor((128 - rows[0].length * scale) / 2);
  const originY = 22;

  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      const color = palette[rows[y][x]];
      if (!color) continue;
      context.fillStyle = color;
      context.fillRect(originX + x * scale, originY + y * scale, scale, scale);
    }
  }
}
