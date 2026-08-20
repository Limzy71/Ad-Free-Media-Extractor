declare module "data-text:*" {
  const content: string;
  export default content;
}

declare module "data-base64:*" {
  const content: string;
  export default content;
}

declare module "url:*" {
  const content: string;
  export default content;
}

declare module "mux.js" {
  export namespace mp4 {
    export interface TransmuxerSegment {
      initSegment?: Uint8Array;
      data?: Uint8Array;
    }

    export class Transmuxer {
      constructor(options?: { keepOriginalTimestamps?: boolean });
      on(event: 'data', callback: (segment: TransmuxerSegment) => void): void;
      on(event: 'done', callback: () => void): void;
      push(data: Uint8Array): void;
      flush(): void;
      dispose(): void;
    }
  }

  const muxjs: {
    mp4: {
      Transmuxer: typeof mp4.Transmuxer;
    };
  };

  export default muxjs;
}
