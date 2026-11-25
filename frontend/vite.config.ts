import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
	// Só PORT é lida pelo processo Vite; credenciais do banco não entram no bundle.
	// loadEnv também copia o NODE_ENV do .env do backend para o Vite, o que
	// faria `vite build` gerar o React de desenvolvimento; o valor é descartado.
	const nodeEnvAnterior = process.env.VITE_USER_NODE_ENV
	const backendEnv = loadEnv(
		mode,
		fileURLToPath(new URL('../backend', import.meta.url)),
		'PORT'
	)
	if (nodeEnvAnterior === undefined) delete process.env.VITE_USER_NODE_ENV
	else process.env.VITE_USER_NODE_ENV = nodeEnvAnterior
	const apiPort = process.env.PORT ?? backendEnv.PORT ?? '3000'
	return {
		plugins: [react(), tailwindcss()],
		server: {
			host: '127.0.0.1',
			port: 5173,
			strictPort: true,
			proxy: {
				'^/api(?:/|$)': `http://127.0.0.1:${apiPort}`,
				'^/health(?:/|$)': `http://127.0.0.1:${apiPort}`,
				'^/docs(?:/|$)': `http://127.0.0.1:${apiPort}`
			}
		},
		build: {
			rollupOptions: {
				output: {
					// PrimeReact em arquivo próprio: muda menos que o código do painel
					// e mantém cada chunk abaixo do aviso de 500 kB do Vite.
					manualChunks(id: string) {
						if (/node_modules\/(primereact|react-transition-group)\//.test(id))
							return 'primereact'
					}
				}
			}
		}
	}
})
