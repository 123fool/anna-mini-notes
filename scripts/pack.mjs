import { run, toolDir } from './common.mjs';

run('go', ['run', './cmd/pack'], { cwd: toolDir });
