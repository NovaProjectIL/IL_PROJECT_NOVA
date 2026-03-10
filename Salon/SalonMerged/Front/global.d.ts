declare module '*.css';
declare module '*.scss';
declare module '*.sass';
declare module 'react-player' {
  import { ComponentType, RefAttributes } from 'react';
  
  interface ReactPlayerProps {
    url?: string;
    playing?: boolean;
    controls?: boolean;
    volume?: number;
    muted?: boolean;
    playbackRate?: number;
    width?: string | number;
    height?: string | number;
    style?: React.CSSProperties;
    progressInterval?: number;
    playsinline?: boolean;
    pip?: boolean;
    stopOnUnmount?: boolean;
    light?: boolean | string;
    fallback?: React.ReactElement;
    wrapper?: React.ComponentType<{ children: React.ReactNode }>;
    playIcon?: React.ReactElement;
    previewTabIndex?: number;
    config?: object;
    onReady?: (player: any) => void;
    onStart?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
    onBuffer?: () => void;
    onBufferEnd?: () => void;
    onEnded?: () => void;
    onError?: (error: any, data?: any, hlsInstance?: any, hlsGlobal?: any) => void;
    onDuration?: (duration: number) => void;
    onSeek?: (seconds: number) => void;
    onProgress?: (state: {
      played: number;
      playedSeconds: number;
      loaded: number;
      loadedSeconds: number;
    }) => void;
    onClickPreview?: (event: React.MouseEvent<HTMLDivElement>) => void;
    onEnablePIP?: () => void;
    onDisablePIP?: () => void;
  }

  const ReactPlayer: ComponentType<ReactPlayerProps & RefAttributes<any>>;
  export default ReactPlayer;
}
