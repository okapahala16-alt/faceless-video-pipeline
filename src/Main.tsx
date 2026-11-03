import React from 'react';
import {AbsoluteFill, Audio, staticFile, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {World} from './World';
import {Overlay, SafeZones} from './Overlay';
import {SfxDemo} from './SfxDemo';
import {tl} from './timeline';

export type MainProps = {showSafeZones?: boolean};

export const Main: React.FC<MainProps> = ({showSafeZones}) => {
  const {width, height} = useVideoConfig();
  if (tl.mode === 'sfxdemo') {
    return <AbsoluteFill>
      <SfxDemo />
      {showSafeZones && <SafeZones />}
      <Audio src={staticFile('audio/mix.wav')} />
    </AbsoluteFill>;
  }
  return (
    <AbsoluteFill style={{backgroundColor: '#8fd3ff'}}>
      <ThreeCanvas width={width} height={height} shadows dpr={1} camera={{fov: 50, near: 0.1, far: 900, position: [20, 15, 30]}}
        gl={{antialias: true, preserveDrawingBuffer: true}}>
        <World />
      </ThreeCanvas>
      <Overlay />
      {showSafeZones && <SafeZones />}
      <Audio src={staticFile('audio/mix.wav')} />
    </AbsoluteFill>
  );
};
