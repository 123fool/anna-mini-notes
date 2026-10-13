declare module '@anna-ai/app-runtime' {
  export const AnnaAppRuntime: {
    connect(): Promise<import('./anna').AnnaConnection>;
  };
}
