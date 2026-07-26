import { createServer } from 'vite';

export default async function globalSetup() {
  process.env.VITE_FEEDBACK_ENABLED ||= 'true';
  const server = await createServer({
    logLevel: 'error',
    server: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
    },
  });
  await server.listen();

  return async () => {
    await server.close();
  };
}
