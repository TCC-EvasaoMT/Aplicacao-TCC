import { isIP } from 'node:net'

// Proxies cujo X-Forwarded-For o servidor aceita, como o Nginx na frente da
// API. Sem eles, o IP de quem conecta é o do proxy, e todos os visitantes
// dividem a mesma cota de requisições e de tentativas de login.
export function lerProxiesConfiaveis(valor: string | undefined): string[] {
	if (!valor?.trim()) return []
	return valor.split(',').map((item) => {
		const endereco = item.trim()
		if (!enderecoValido(endereco))
			throw new Error(
				'HTTP_TRUST_PROXY deve ter IPs ou faixas CIDR separados por vírgula, como 172.18.0.2 ou 10.0.0.0/24, sem 0.0.0.0/0'
			)
		return endereco
	})
}

function enderecoValido(endereco: string) {
	const [ip = '', prefixo, ...resto] = endereco.split('/')
	const versao = isIP(ip)
	if (versao === 0 || resto.length) return false
	if (prefixo === undefined) return true
	if (!/^\d{1,3}$/.test(prefixo)) return false
	// Prefixo zero confiaria em qualquer origem, o mesmo que trustProxy: true.
	return Number(prefixo) >= 1 && Number(prefixo) <= (versao === 4 ? 32 : 128)
}
