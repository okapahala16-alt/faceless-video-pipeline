import {Composition} from 'remotion';
import {Main} from './Main';
import {tl, FPS} from './timeline';
export const RemotionRoot = () => (
  <Composition id="Main" component={Main} durationInFrames={Math.ceil(tl.duration * FPS)} fps={FPS} width={1080} height={1920}
    defaultProps={{showSafeZones: false}} />
);
