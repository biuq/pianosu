import { NoteMessage } from "./piano-engine";

const TOTAL_KEYS = 88;

interface Tile {
  x: number;
  y: number;
  name: string;
  intensity: number;
  inradius: number;
  circumradius(): number;
}

const makeTile = ({
  x = 0,
  y = 0,
  name = '',
  intensity = 0,
  inradius = 1
}: Partial<Tile>): Tile => {
  return {
    x,
    y,
    name,
    intensity,
    inradius,
    circumradius() { return this.inradius * (2 / Math.sqrt(3)); },
  };
};

const adjacentTile = (tile: Tile, direction: number, name: string): Tile => {
  direction = (Math.PI / 3) * (direction % 6);

  return makeTile({
    x: tile.x + tile.circumradius() * Math.sin(direction) * Math.sqrt(3),
    y: tile.y + tile.circumradius() * Math.cos(direction) * Math.sqrt(3),
    name: name,
    inradius: tile.inradius
  });
};

const translatedTile = (tile: Tile, name: string): Tile => {
  return makeTile({
    x: tile.x + tile.circumradius() * 3,
    y: tile.y,
    name: name,
    inradius: tile.inradius
  });
};

export class HexagonPianoVisualization {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tiles: Tile[] = [];
  private hexRadius: number = 1;
  private scale: number = 1;
  private hitEffects: HitEffect[] = [];

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const container = document.getElementById('pianoVisualizationContainer') as HTMLElement;

    // Set canvas size to match container size
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;

    // Calculate the scale based on the canvas size
    const minDimension = Math.min(this.canvas.width, this.canvas.height);
    this.scale = minDimension / 1000; // Adjust 1000 to fit your design
    this.hexRadius = 70 * this.scale;

    this.createTiles();
    this.drawKeyboard();
  }

  init() {
    this.resize();
  }

  createTiles() {
    const refx = 0;
    const refy = this.canvas.height - this.hexRadius * 1.1;
    let prevC = makeTile({ x: refx, y: refy, name: 'F', inradius: this.hexRadius });
    this.tiles = [];

    for (let i = 0; i <= 8; i++) {
      const c = translatedTile(prevC, `C${i}`);
      const cSharp = adjacentTile(c, 4, `C#${i}`);
      const d = adjacentTile(c, 3, `D${i}`);
      const dSharp = adjacentTile(d, 4, `D#${i}`);
      const e = adjacentTile(d, 3, `E${i}`);
      const f = adjacentTile(e, 3, `F${i}`);
      const fSharp = adjacentTile(f, 4, `F#${i}`);
      const g = adjacentTile(f, 3, `G${i}`);
      const gSharp = adjacentTile(g, 4, `G#${i}`);
      const a = adjacentTile(g, 3, `A${i}`);
      const aSharp = adjacentTile(a, 4, `A#${i}`);
      const b = adjacentTile(a, 3, `B${i}`);

      if (i === 0) {
        this.tiles.push(a, aSharp, b);
      } else if (i === 8) {
        this.tiles.push(c);
      } else {
        this.tiles.push(c, cSharp, d, dSharp, e, f, fSharp, g, gSharp, a, aSharp, b);
      }

      prevC = c;
    }
  }

  updateKey(note: NoteMessage) {
    const index = note.getNoteNumber();
    if (index >= 0 && index < TOTAL_KEYS) {
      this.tiles[index].intensity = note.getNormalizedVelocity();
    }
  }

  addHitEffect(index: number) {
    const tile = this.tiles[index];
    this.hitEffects.push({
      x: tile.x,
      y: tile.y,
      radius: tile.circumradius(),
      alpha: 1,
      scale: 1,
    });
  }

  drawTile(tile: Tile) {
    const modifier = (tile.intensity > 0 ? tile.intensity * 0.9 + 0.1 : 0) * this.scale;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
    this.ctx.lineWidth = 2 * this.scale + modifier * 10;
    this.ctx.shadowBlur = 50 * modifier;
    this.ctx.shadowColor = 'rgba(255, 255, 255, 1.0)';

    if (tile.name.includes("#")) {
      this.ctx.strokeStyle = 'rgba(255, 0, 255, 1.0)';
    }

    this.ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const hx = tile.x + (tile.inradius + modifier * 10) * Math.cos(angle);
      const hy = tile.y + (tile.inradius + modifier * 10) * Math.sin(angle);
      if (i === 0) {
        this.ctx.moveTo(hx, hy);
      } else {
        this.ctx.lineTo(hx, hy);
      }
    }
    this.ctx.closePath();
    this.ctx.stroke();

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.font = `${this.hexRadius * 0.5}px Monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`${tile.name}`, tile.x, tile.y);
  }

  drawKeyboard() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (const tile of this.tiles) {
      this.drawTile(tile);
    }
  }

  midiNoteToName(midiNote: number) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteName = noteNames[midiNote % 12];
    const octave = Math.floor(midiNote / 12) - 1;
    return `${noteName}${octave}`;
  }

  render(dt: number) {
    this.drawKeyboard();
    this.drawTimeTiles(dt);
    this.drawHitEffects();
  }

  timeTiles: Map<string, TimeTile> = new Map();

  drawTimeTiles(dt: number) {
    for (const timeTile of this.timeTiles.values()) {
      timeTile.current += dt;

      const existingTile = this.tiles[timeTile.noteNumber];
      const newTile = makeTile({ x: existingTile.x, y: existingTile.y, name: existingTile.name, inradius: existingTile.inradius });

      if (timeTile.current < 0) {
        const scale = 1 - (Math.min(0.99, Math.abs(timeTile.current * 0.5)));
        newTile.inradius = existingTile.inradius * scale;
        newTile.intensity = 0;
      } else {
        newTile.intensity = 1 - Math.min(1, Math.abs(timeTile.current / timeTile.end));
      }

      if (newTile.inradius > existingTile.inradius) {
        newTile.inradius = existingTile.inradius;
      }
      this.drawTile(newTile);
      if (timeTile.current >= timeTile.end) {
        this.timeTiles.delete(`${timeTile.timestamp}-${timeTile.noteNumber}`);
      }
    }
  }

  addTimeTile(timestamp: number, noteNumber: number, start: number, end: number) {
    const id = `${timestamp}-${noteNumber}`;
    if (this.timeTiles.has(id)) {
      return;
    }
    this.timeTiles.set(id, { timestamp, noteNumber, start, end, current: start });
  }

  triggerHitEffect(noteNumber: number) {
    const index = noteNumber;
    if (index >= 0 && index < this.tiles.length) {
      this.addHitEffect(index);
    }
  }

  drawHitEffects() {
    this.ctx.save();
    for (let i = this.hitEffects.length - 1; i >= 0; i--) {
      const effect = this.hitEffects[i];
      this.ctx.beginPath();
      this.ctx.arc(effect.x, effect.y, effect.radius * effect.scale, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${effect.alpha})`;
      this.ctx.lineWidth = 2 * this.scale;
      this.ctx.stroke();

      // Update effect properties
      effect.alpha -= 0.02;
      effect.scale += 0.05;

      // Remove effect if it's faded out
      if (effect.alpha <= 0) {
        this.hitEffects.splice(i, 1);
      }
    }
    this.ctx.restore();
  }
}

interface TimeTile {
  timestamp: number;
  noteNumber: number;
  start: number;
  current: number;
  end: number;
}

interface HitEffect {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  scale: number;
}
