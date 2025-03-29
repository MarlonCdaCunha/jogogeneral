import { createClient } from "@supabase/supabase-js"

// Tipos
export type Jogador = {
  id: number
  nome: string
  criado_em: string
  atualizado_em: string
}

export type JogadorInsert = {
  id?: number
  nome: string
  criado_em?: string
  atualizado_em?: string
}

export type JogadorComEstatisticas = Jogador & {
  jogos: number
  vitorias: number
  taxa_vitoria: number
}

export type Categoria = {
  id: number
  nome: string
  codigo: string
  secao: string
  ordem: number
  descricao: string | null
}

export type Jogo = {
  id: number
  data_jogo: string
  finalizado: boolean
  criado_em: string
  atualizado_em: string
}

export type PontuacaoInsert = {
  jogo_id: number
  jogador_id: number
  categoria_id: number
  pontos: number
}

export type JogoCompleto = {
  jogo: Jogo
  participantes: Array<{
    jogador_id: number
    nome_jogador: string
    pontuacao_total: number
    vencedor: boolean
  }>
}

// Cliente Supabase
const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Singleton para o cliente
let supabaseClient: ReturnType<typeof createSupabaseClient>

const getSupabase = () => {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient()
  }
  return supabaseClient
}

// Serviços de Jogadores
export async function listarJogadores(): Promise<JogadorComEstatisticas[]> {
  const supabase = getSupabase()

  const { data: jogadores, error } = await supabase.from("jogadores").select("*").order("nome")

  if (error) {
    console.error("Erro ao listar jogadores:", error)
    throw error
  }

  // Buscar estatísticas para cada jogador
  const jogadoresComEstatisticas = await Promise.all(
    jogadores.map(async (jogador) => {
      const { data: estatisticas, error: estatisticasError } = await supabase.rpc("obter_estatisticas_jogador", {
        jogador_id_param: jogador.id,
      })

      if (estatisticasError) {
        console.error("Erro ao buscar estatísticas:", estatisticasError)
        return {
          ...jogador,
          jogos: 0,
          vitorias: 0,
          taxa_vitoria: 0,
        }
      }

      const stats = estatisticas[0]
      return {
        ...jogador,
        jogos: stats?.total_jogos || 0,
        vitorias: stats?.total_vitorias || 0,
        taxa_vitoria: stats?.taxa_vitoria || 0,
      }
    }),
  )

  return jogadoresComEstatisticas
}

export async function adicionarJogador(jogador: JogadorInsert): Promise<Jogador> {
  const supabase = getSupabase()

  const { data, error } = await supabase.from("jogadores").insert(jogador).select().single()

  if (error) {
    console.error("Erro ao adicionar jogador:", error)
    throw error
  }

  return data
}

export async function excluirJogador(id: number): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase.from("jogadores").delete().eq("id", id)

  if (error) {
    console.error("Erro ao excluir jogador:", error)
    throw error
  }
}

// Serviços de Categorias
export async function listarCategorias(): Promise<Categoria[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase.from("categorias").select("*").order("ordem")

  if (error) {
    console.error("Erro ao listar categorias:", error)
    throw error
  }

  return data
}

export async function listarCategoriasPorSecao(secao: "superior" | "inferior"): Promise<Categoria[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase.from("categorias").select("*").eq("secao", secao).order("ordem")

  if (error) {
    console.error(`Erro ao listar categorias da seção ${secao}:`, error)
    throw error
  }

  return data
}

// Serviços de Jogos
export async function criarNovoJogo(): Promise<Jogo> {
  const supabase = getSupabase()

  try {
    console.log("Criando novo jogo...")
    const { data, error } = await supabase.from("jogos").insert({}).select().single()

    if (error) {
      console.error("Erro ao criar novo jogo:", error)
      throw error
    }

    if (!data) {
      throw new Error("Nenhum dado retornado ao criar novo jogo")
    }

    console.log("Novo jogo criado:", data)
    return data
  } catch (error) {
    console.error("Exceção ao criar novo jogo:", error)
    throw error
  }
}

export async function adicionarParticipantes(jogo_id: number, jogador_ids: number[]): Promise<void> {
  const supabase = getSupabase()

  try {
    console.log("Adicionando participantes ao jogo:", jogo_id, jogador_ids)

    if (!jogo_id) {
      throw new Error("ID do jogo inválido")
    }

    if (jogador_ids.length === 0) {
      throw new Error("Nenhum jogador selecionado")
    }

    const participantes = jogador_ids.map((jogador_id) => ({
      jogo_id,
      jogador_id,
      vencedor: false,
    }))

    const { error } = await supabase.from("participantes").insert(participantes)

    if (error) {
      console.error("Erro ao adicionar participantes:", error)
      throw error
    }

    console.log("Participantes adicionados com sucesso")
  } catch (error) {
    console.error("Exceção ao adicionar participantes:", error)
    throw error
  }
}

export async function salvarPontuacao(pontuacao: PontuacaoInsert): Promise<void> {
  const supabase = getSupabase()

  // Verificar se já existe uma pontuação para este jogador, jogo e categoria
  const { data: existente } = await supabase
    .from("pontuacoes")
    .select("id")
    .eq("jogo_id", pontuacao.jogo_id)
    .eq("jogador_id", pontuacao.jogador_id)
    .eq("categoria_id", pontuacao.categoria_id)
    .maybeSingle()

  if (existente) {
    // Atualizar pontuação existente
    const { error } = await supabase.from("pontuacoes").update({ pontos: pontuacao.pontos }).eq("id", existente.id)

    if (error) {
      console.error("Erro ao atualizar pontuação:", error)
      throw error
    }
  } else {
    // Inserir nova pontuação
    const { error } = await supabase.from("pontuacoes").insert(pontuacao)

    if (error) {
      console.error("Erro ao salvar pontuação:", error)
      throw error
    }
  }
}

export async function finalizarJogo(jogo_id: number): Promise<void> {
  const supabase = getSupabase()

  try {
    console.log("Finalizando jogo:", jogo_id)

    if (!jogo_id) {
      throw new Error("ID do jogo inválido")
    }

    // Buscar todas as pontuações deste jogo
    const { data: pontuacoes, error: pontuacoesError } = await supabase
      .from("pontuacoes")
      .select("jogador_id, pontos")
      .eq("jogo_id", jogo_id)

    if (pontuacoesError) {
      console.error("Erro ao buscar pontuações:", pontuacoesError)
      throw pontuacoesError
    }

    // Calcular pontuação total por jogador
    const pontuacoesPorJogador = pontuacoes.reduce(
      (acc, curr) => {
        acc[curr.jogador_id] = (acc[curr.jogador_id] || 0) + curr.pontos
        return acc
      },
      {} as Record<number, number>,
    )

    // Encontrar o jogador com maior pontuação
    let maiorPontuacao = 0
    let vencedorId = 0

    Object.entries(pontuacoesPorJogador).forEach(([jogadorId, pontos]) => {
      if (pontos > maiorPontuacao) {
        maiorPontuacao = pontos
        vencedorId = Number(jogadorId)
      }
    })

    // Atualizar o vencedor
    if (vencedorId) {
      console.log("Definindo vencedor:", vencedorId)
      const { error: updateError } = await supabase
        .from("participantes")
        .update({ vencedor: true })
        .eq("jogo_id", jogo_id)
        .eq("jogador_id", vencedorId)

      if (updateError) {
        console.error("Erro ao atualizar vencedor:", updateError)
        throw updateError
      }
    } else {
      console.log("Nenhum vencedor encontrado")
    }

    // Marcar jogo como finalizado
    const { error } = await supabase.from("jogos").update({ finalizado: true }).eq("id", jogo_id)

    if (error) {
      console.error("Erro ao finalizar jogo:", error)
      throw error
    }

    console.log("Jogo finalizado com sucesso")
  } catch (error) {
    console.error("Exceção ao finalizar jogo:", error)
    throw error
  }
}

export async function listarJogos(): Promise<JogoCompleto[]> {
  const supabase = getSupabase()

  // Buscar jogos finalizados
  const { data: jogos, error: jogosError } = await supabase
    .from("jogos")
    .select("*")
    .eq("finalizado", true)
    .order("data_jogo", { ascending: false })

  if (jogosError) {
    console.error("Erro ao listar jogos:", jogosError)
    throw jogosError
  }

  // Para cada jogo, buscar participantes e pontuações
  const jogosCompletos = await Promise.all(
    jogos.map(async (jogo) => {
      // Buscar participantes
      const { data: participantes, error: participantesError } = await supabase
        .from("participantes")
        .select("jogador_id, vencedor, jogadores(nome)")
        .eq("jogo_id", jogo.id)

      if (participantesError) {
        console.error("Erro ao buscar participantes:", participantesError)
        throw participantesError
      }

      // Buscar pontuações
      const { data: pontuacoes, error: pontuacoesError } = await supabase
        .from("pontuacoes")
        .select("jogador_id, pontos")
        .eq("jogo_id", jogo.id)

      if (pontuacoesError) {
        console.error("Erro ao buscar pontuações:", pontuacoesError)
        throw pontuacoesError
      }

      // Calcular pontuação total por jogador
      const pontuacoesPorJogador = pontuacoes.reduce(
        (acc, curr) => {
          acc[curr.jogador_id] = (acc[curr.jogador_id] || 0) + curr.pontos
          return acc
        },
        {} as Record<number, number>,
      )

      // Montar objeto de retorno
      const participantesCompletos = participantes.map((p) => ({
        jogador_id: p.jogador_id,
        nome_jogador: (p.jogadores as any).nome,
        pontuacao_total: pontuacoesPorJogador[p.jogador_id] || 0,
        vencedor: p.vencedor,
      }))

      return {
        jogo,
        participantes: participantesCompletos,
      }
    }),
  )

  return jogosCompletos
}

