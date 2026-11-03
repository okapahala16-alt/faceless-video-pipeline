import React from 'react';
import {AbsoluteFill, Audio, staticFile, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {World} from './World';
import {Overlay} from './Overlay';

export const Main: React.FC = () => {
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{backgroundColor: '#8fd3ff'}}>
      <ThreeCanvas width={width} height={height} shadows dpr={1} camera={{fov: 50, near: 0.1, far: 900, position: [20, 15, 30]}}
        gl={{antialias: true, preserveDrawingBuffer: true}}>
        <World />
      </ThreeCanvas>
      <Overlay />
      <Audio src={staticFile('audio/mix.wav')} />
    </AbsoluteFill>
  );
};
