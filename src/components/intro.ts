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

    // Banner art with per-character drop shadows.
    // The "shadow" is the non-solid double-line characters (╔╗╚╝═║) placed below and right of each solid letter.
    // SOL (first 3 letters): solid █ (and baked letter doubles) in lighter purple; drop shadow doubles in current purple.
    // DEXTER: solid █ (and baked letter doubles) in white; drop shadow doubles in blue.
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

    function colorMainLine(line: string): string {
      let res = "";
      const SOL_END = 26; // D of DEXTER starts at col 26; 0-25 covers first 3 letters S O L
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const inSOL = i < SOL_END;
        const isSolid = ch === "█";
        const isDouble = "╔╗╚╝═║".indexOf(ch) !== -1;
        if (isSolid || isDouble) {
          // full solid letter (█ fills + its edge doubles) colored in main hue
          res += (inSOL ? solMain : dextMain)(ch);
        } else {
          res += ch;
        }
      }
      return res;
    }

    function makeShadowDrops(line: string): string {
      let res = "";
      const SOL_END = 26;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const inSOL = i < SOL_END;
        const isDouble = "╔╗╚╝═║".indexOf(ch) !== -1;
        if (isDouble) {
          // shadow layer = ONLY the non-solid double-line chars (no █), in shadow hue
          res += (inSOL ? solShadow : dextShadow)(ch);
        } else {
          res += " ";
        }
      }
      return res;
    }

    const mainBannerLines = bannerArtLines.map(colorMainLine);
    const shadowBannerLines = bannerArtLines.map(makeShadowDrops);

    // Render main solid letters, then the drop-shadow copy below (right-shifted by " " prefix).
    // Shadow block contains purely the non-solid double line chars below+right of the solids.
    this.addChild(
      new Text("\n" + mainBannerLines.join("\n"), 0, 0),
    );
    this.addChild(
      new Text(shadowBannerLines.map(l => " " + l).join("\n"), 0, 0),
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
