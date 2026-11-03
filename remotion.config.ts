import {Config} from '@remotion/cli/config';
Config.setChromiumOpenGlRenderer('swangle');
Config.setBrowserExecutable('/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell');
Config.setConcurrency(4);
Config.setVideoImageFormat('jpeg');
