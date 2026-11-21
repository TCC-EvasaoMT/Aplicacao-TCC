import { consultar } from '../../lib/http';

export interface OpcaoCodigo {
  codigo: string;
  nome: string | null;
}

export interface Catalogo {
  anos: number[];
  cursos: OpcaoCodigo[];
  areas_gerais: OpcaoCodigo[];
  municipios_oferta: OpcaoCodigo[];
  municipios_sede: OpcaoCodigo[];
  modalidades: string[];
  categorias_administrativas: string[];
  organizacoes_academicas: string[];
}

export function consultarCatalogo(signal: AbortSignal) {
  return consultar<Catalogo>('/api/v1/filtros', signal);
}
