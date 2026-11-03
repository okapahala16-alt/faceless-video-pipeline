import {Config} from '@remotion/cli/config';
// GPU machine (Windows: "angle", Linux+NVIDIA: "egl"). No GPU: "swangle".
Config.setChromiumOpenGlRenderer((process.env.REMOTION_GL as any) || 'angle');
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
Config.setConcurrency(Number(process.env.REMOTION_CONCURRENCY) || null);
Config.setVideoImageFormat('jpeg');
