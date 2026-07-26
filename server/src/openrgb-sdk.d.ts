// openrgb-sdk ships .d.ts files in dist/ but its package.json "types" field
// points to a non-existent path, so TypeScript cannot resolve them. Minimal
// declarations for the surface this project uses.
declare module "openrgb-sdk" {
  export interface RGBColor {
    red: number;
    green: number;
    blue: number;
  }

  export interface DeviceData {
    deviceId: number;
    type: number;
    name: string;
    modes: { id: number; name: string }[];
    leds: { name: string }[];
    colors: RGBColor[];
  }

  export class Client {
    constructor(name: string, port: number, host: string);
    connect(timeout?: number): Promise<void>;
    disconnect(): void;
    getControllerCount(): Promise<number>;
    getControllerData(deviceId: number): Promise<DeviceData>;
    updateLeds(deviceId: number, colors: RGBColor[]): void;
    updateMode(deviceId: number, mode: number | string): Promise<void>;
    on(event: string, listener: (...args: unknown[]) => void): void;
  }

  export const utils: {
    deviceType: {
      keyboard: number;
      [key: string]: number;
    };
  };

  const openrgbSdk: {
    Client: typeof Client;
    utils: typeof utils;
  };
  export default openrgbSdk;
}
