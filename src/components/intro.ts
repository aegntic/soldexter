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

    // SOL in purple, DEXTER in pastel blue
    const sol = chalk.hex('#b47aff').bold;
    const dext = chalk.hex('#7ec8f8').bold;

    const bannerLines = [
      ` ${sol('███████╗')} ${dext('██████╗ ██╗     ██████╗ ███████╗██╗  ██╗████████╗███████╗██████╗ ')}`,
      ` ${sol('██╔════╝')}${dext('██╔═══██╗██║     ██╔══██╗██╔════╝╚██╗██╔╝╚══██╔══╝██╔════╝██╔══██╗')}`,
      ` ${sol('███████╗')}${dext('██║   ██║██║     ██║  ██║█████╗   ╚███╔╝    ██║   █████╗  ██████╔╝')}`,
      ` ${sol('╚════██║')}${dext('██║   ██║██║     ██║  ██║██╔══╝   ██╔██╗    ██║   ██╔══╝  ██╔══██╗')}`,
      ` ${sol('███████║')}${dext('╚██████╔╝███████╗██████╔╝███████╗██╔╝ ██╗   ██║   ███████╗██║  ██║')}`,
      ` ${sol('╚══════╝')}${dext(' ╚═════╝ ╚══════╝╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝')}`,
    ];

    this.addChild(
      new Text('\n' + bannerLines.join('\n'), 0, 0),
    );

    this.addChild(new Spacer(1));
    this.addChild(new Text('Your Solana research and trading intelligence agent.', 0, 0));
    this.modelText = new Text('', 0, 0);
    this.addChild(this.modelText);
    this.setModel(model);
  }

  setModel(model: string) {
    this.modelText.setText(
      `${theme.muted('Model: ')}${theme.primary(getModelDisplayName(model))}`,
    );
  }
}
