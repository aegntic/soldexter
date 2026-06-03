import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import packageJson from '../../package.json';
import { getModelDisplayName } from '../utils/model.js';
import { theme } from '../theme.js';

const INTRO_WIDTH = 50;

export class IntroComponent extends Container {
  private readonly modelText: Text;

  constructor(model: string) {
    super();

    const welcomeText = 'Welcome to Soldexter';
    const versionText = ` v${packageJson.version}`;
    const fullText = welcomeText + versionText;
    const padding = Math.floor((INTRO_WIDTH - fullText.length - 2) / 2);
    const trailing = INTRO_WIDTH - fullText.length - padding - 2;

    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.primary('═'.repeat(INTRO_WIDTH)), 0, 0));
    this.addChild(
      new Text(
        theme.primary(
          `║${' '.repeat(padding)}${theme.bold(welcomeText)}${theme.muted(versionText)}${' '.repeat(
            trailing,
          )}║`,
        ),
        0,
        0,
      ),
    );
    this.addChild(new Text(theme.primary('═'.repeat(INTRO_WIDTH)), 0, 0));
    this.addChild(new Spacer(1));

    // Banner art with tight per-letter drop shadows using non-solid double-line chars.
    // Shadow doubles (╔╗╚╝═║) are placed +1 row and +1 col from the solid letter parts that cast them.
    // SOL (cols 0-25, first 3 letters): solid █ + baked edges in lighter purple (#c084fc);
    //   their cast drop-shadow doubles in purple (#b47aff).
    // DEXTER: solid in white; cast drop-shadow doubles in blue (#258bff).
    // Implemented by laying main solids first, then overlaying only-double shadows in the offset cells (main wins on overlap).
    const solMain = chalk.hex('#c084fc').bold;   // lighter purple for SOL solid letters
    const solShadow = chalk.hex('#b47aff').bold; // current purple for SOL drop-shadow doubles
    const dextMain = chalk.hex('#ffffff').bold;  // white for DEXTER solid letters
    const dextShadow = chalk.hex('#258bff').bold; // blue for DEXTER drop-shadow doubles

    const bannerArtLines = [
      " ███████╗ ██████╗ ██╗     ██████╗ ███████╗██╗  ██╗████████╗███████╗██████╗ ",
      " ██╔════╝██╔═══██╗██║     ██╔══██╗██╔════╝╚██╗██╔╝╚══██╔══╝██╔════╝██╔══██╗",
      " ███████╗██║   ██║██║     ██║  ██║█████╗   ╚███╔╝    ██║   █████╗  ██████╔╝",
      " ╚════██║██║   ██║██║     ██║  ██║██╔══╝   ██╔██╗    ██║   ██╔══╝  ██╔══██╗",
      " ███████║╚██████╔╝███████╗██████╔╝███████╗██╔╝ ██╗   ██║   ███████╗██║  ██║",
      " ╚══════╝ ╚═════╝ ╚══════╝╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝"
    ];

    const rawLines = bannerArtLines;
    const W = rawLines[0].length; // 75 visual cols

    // 7 rows: 0-5 hold the main solid letters; row 6 holds the bottom cast of the last row's shadow.
    // Each cell holds either ' ' or a chalk-colored single-char string (ANSI-wrapped).
    const cellRows: string[][] = Array.from({ length: 7 }, () => Array(W + 5).fill(' '));

    // 1. Place the solid letters (█ fills + any baked-in double edges that are part of the letter design)
    //    using the main color for the group (SOL lighter purple, DEXTER white).
    for (let r = 0; r < 6; r++) {
      const line = rawLines[r];
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        const inSOL = c < 26;
        const isSolid = ch === '█';
        const isDouble = '╔╗╚╝═║'.indexOf(ch) !== -1;
        if (isSolid || isDouble) {
          const colorFn = inSOL ? solMain : dextMain;
          cellRows[r][c] = colorFn(ch);
        } else if (ch !== ' ') {
          cellRows[r][c] = ch;
        }
      }
    }

    // 2. Cast the drop shadows: for every double-line char in the raw art, place a copy
    //    at (row+1, col+1) using only the shadow color. Do not overwrite main solids.
    for (let r = 0; r < 6; r++) {
      const line = rawLines[r];
      const targetR = r + 1;
      if (targetR >= 7) continue;
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if ('╔╗╚╝═║'.indexOf(ch) !== -1) {
          const inSOL = c < 26;
          const colorFn = inSOL ? solShadow : dextShadow;
          const targetC = c + 1;
          if (cellRows[targetR][targetC] === ' ') {
            cellRows[targetR][targetC] = colorFn(ch);
          }
        }
      }
    }

    // 3. Assemble into colored lines (one Text block). Shadow doubles now appear inside
    //    the banner, immediately below + right of the solid letters that cast them.
    const bannerOutputLines = cellRows
      .map((cells) => cells.join('').replace(/\s+$/, ''))
      .filter((line, idx) => line.length > 0 || idx < 6);

    this.addChild(
      new Text('\n' + bannerOutputLines.join('\n'), 0, 0),
    );

    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.primaryLight('Your Solana research and trading intelligence agent.'), 0, 0));
    this.modelText = new Text('', 0, 0);
    this.addChild(this.modelText);
    this.setModel(model);
  }

  setModel(model: string) {
    this.modelText.setText(
      `${theme.muted('Model: ')}${theme.primaryLight(getModelDisplayName(model))}`,
    );
  }
}
