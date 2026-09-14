import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hoje, somaDias, somaDiasUteis } from '../src/lib/datas'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

/**
 * As datas do seed são relativas a hoje, nunca fixas. Com datas fixas o seed
 * envelhece: uma semana depois todas as reservas de exemplo estariam no
 * passado e o painel abriria vazio, porque o filtro padrão só mostra futuras.
 */
const D = {
  passado: somaDias(hoje(), -7),
  d1: somaDiasUteis(hoje(), 3), // primeira data que o formulário aceita
  d2: somaDiasUteis(hoje(), 4),
  d3: somaDiasUteis(hoje(), 5),
}

type Semente = {
  nomeSolicitante: string
  dataNascimento: string
  telefone: string
  email: string
  tipoVinculo: string
  codigoMembresia?: string | null
  espaco: string
  data: string
  horaInicio: string
  horaFim: string
  finalidade: string
  status: string
  observacaoAdmin?: string | null
}

/*
 * O conjunto cobre de propósito:
 *  - os cinco status;
 *  - os três espaços;
 *  - os cinco tipos de vínculo (membro com código, não membro sem);
 *  - uma data passada, para testar o filtro "incluir datas passadas";
 *  - um horário liberado por rejeição (campo, d1, 15h–17h): tente criar um
 *    pedido nesse mesmo horário pelo formulário — ele deve ser aceito, porque
 *    REJEITADO não ocupa o espaço;
 *  - reservas encostadas no mesmo espaço e dia (vôlei, d2, 16h–18h e 18h–20h),
 *    que NÃO conflitam entre si.
 */
const RESERVAS: Semente[] = [
  {
    nomeSolicitante: 'Ana Carolina Ribeiro',
    dataNascimento: '1995-03-12',
    telefone: '11987654321',
    email: 'ana.ribeiro@exemplo.com',
    tipoVinculo: 'MEMBRO',
    codigoMembresia: '48213',
    espaco: 'QUADRA_SOCIETY',
    data: D.d1,
    horaInicio: '19:00',
    horaFim: '21:00',
    finalidade: 'Treino do time de futsal do ministério de jovens.',
    status: 'PENDENTE',
  },
  {
    nomeSolicitante: 'Bruno Tavares Lima',
    dataNascimento: '1988-11-30',
    telefone: '11991234567',
    email: 'bruno.lima@exemplo.com',
    tipoVinculo: 'LIDER_MINISTERIO',
    espaco: 'VOLEI_AREIA',
    data: D.d1,
    horaInicio: '08:00',
    horaFim: '10:00',
    finalidade: 'Encontro matinal do ministério de casais com atividade esportiva.',
    status: 'PENDENTE',
  },
  {
    nomeSolicitante: 'Eduardo Matos Pereira',
    dataNascimento: '2001-07-04',
    telefone: '11993456789',
    email: 'eduardo.matos@exemplo.com',
    tipoVinculo: 'NAO_MEMBRO',
    espaco: 'CAMPO_FUTEBOL',
    data: D.d1,
    horaInicio: '15:00',
    horaFim: '17:00',
    finalidade: 'Partida entre amigos do bairro.',
    status: 'REJEITADO',
    observacaoAdmin: 'Campo reservado para a manutenção do gramado nesta data.',
  },
  {
    nomeSolicitante: 'Carla Souza Andrade',
    dataNascimento: '1979-01-22',
    telefone: '11996543210',
    email: 'carla.andrade@exemplo.com',
    tipoVinculo: 'SUPERVISOR_COORD_LIDER_GRUPO',
    espaco: 'CAMPO_FUTEBOL',
    data: D.d2,
    horaInicio: '15:00',
    horaFim: '17:00',
    finalidade: 'Confraternização dos grupos da Cidade da região sul.',
    status: 'APROVADO',
    observacaoAdmin: 'Aprovado. Ligar para confirmar e passar as instruções de acesso.',
  },
  {
    nomeSolicitante: 'Gabriel Nunes Ferreira',
    dataNascimento: '1993-09-18',
    telefone: '11994567890',
    email: 'gabriel.nunes@exemplo.com',
    tipoVinculo: 'MEMBRO',
    codigoMembresia: '31907',
    espaco: 'VOLEI_AREIA',
    data: D.d2,
    horaInicio: '16:00',
    horaFim: '18:00',
    finalidade: 'Treino da equipe de vôlei que representa a igreja no torneio regional.',
    status: 'APROVADO',
  },
  {
    nomeSolicitante: 'Diego Almeida Rocha',
    dataNascimento: '1985-05-09',
    telefone: '11992345678',
    email: 'diego.rocha@exemplo.com',
    tipoVinculo: 'PASTOR_MINISTRO_OBREIRO',
    espaco: 'VOLEI_AREIA',
    data: D.d2,
    horaInicio: '18:00',
    horaFim: '20:00',
    finalidade: 'Atividade de integração da equipe pastoral.',
    status: 'CONFIRMADO',
    observacaoAdmin: 'Contato feito em 10/09. Chave retirada na recepção.',
  },
  {
    nomeSolicitante: 'Fernanda Castro Dias',
    dataNascimento: '1998-12-02',
    telefone: '11998765432',
    email: 'fernanda.dias@exemplo.com',
    tipoVinculo: 'MEMBRO',
    codigoMembresia: '52664',
    espaco: 'QUADRA_SOCIETY',
    data: D.d3,
    horaInicio: '07:00',
    horaFim: '09:00',
    finalidade: 'Treino do grupo de corrida antes do expediente.',
    status: 'CONFIRMADO',
  },
  {
    nomeSolicitante: 'Ana Carolina Ribeiro',
    dataNascimento: '1995-03-12',
    telefone: '11987654321',
    email: 'ana.ribeiro@exemplo.com',
    tipoVinculo: 'MEMBRO',
    codigoMembresia: '48213',
    espaco: 'VOLEI_AREIA',
    data: D.d3,
    horaInicio: '09:00',
    horaFim: '11:00',
    finalidade: 'Amistoso de vôlei entre células.',
    status: 'CANCELADO',
    observacaoAdmin: 'A solicitante desistiu por conflito de agenda.',
  },
  {
    nomeSolicitante: 'Helena Barbosa Cruz',
    dataNascimento: '1990-06-27',
    telefone: '11995678901',
    email: 'helena.cruz@exemplo.com',
    tipoVinculo: 'LIDER_MINISTERIO',
    espaco: 'CAMPO_FUTEBOL',
    data: D.passado,
    horaInicio: '16:00',
    horaFim: '18:00',
    finalidade: 'Encerramento do campeonato interno do ministério infantil.',
    status: 'CONFIRMADO',
  },
]

/**
 * Sequência de status pela qual cada reserva teria passado até o estado final.
 * Uma reserva cancelada, por exemplo, passou antes por pendente e aprovada.
 */
const CAMINHO: Record<string, string[]> = {
  PENDENTE: ['PENDENTE'],
  APROVADO: ['PENDENTE', 'APROVADO'],
  REJEITADO: ['PENDENTE', 'REJEITADO'],
  CONFIRMADO: ['PENDENTE', 'APROVADO', 'CONFIRMADO'],
  CANCELADO: ['PENDENTE', 'APROVADO', 'CANCELADO'],
}

async function main() {
  // ---------- Admin ----------
  const usuario = process.env.ADMIN_USUARIO || 'vitor'

  // Sem senha no .env, geramos uma aleatória e imprimimos. Um valor padrão
  // fixo do tipo "admin123" acabaria em produção mais cedo ou mais tarde.
  const senhaDoEnv = process.env.ADMIN_SENHA
  const senha = senhaDoEnv || randomBytes(9).toString('base64url')

  await prisma.adminUser.upsert({
    where: { usuario },
    update: { senhaHash: await bcrypt.hash(senha, 12) },
    create: { usuario, senhaHash: await bcrypt.hash(senha, 12) },
  })

  // ---------- Reservas ----------
  // Recriadas do zero para o seed ser idempotente: rodar duas vezes não
  // duplica os exemplos nem cria conflitos consigo mesmo.
  await prisma.logAcao.deleteMany()
  await prisma.reserva.deleteMany()

  for (const r of RESERVAS) {
    const criada = await prisma.reserva.create({ data: r })

    // Trilha de auditoria coerente: o caminho completo que a reserva teria
    // percorrido de verdade até chegar ao status final.
    const caminho = CAMINHO[r.status]
    let de: string | null = null

    for (const para of caminho) {
      await prisma.logAcao.create({
        data: {
          reservaId: criada.id,
          de,
          para,
          observacao:
            de === null
              ? 'Pedido enviado pelo formulário público.'
              : para === r.status
                ? (r.observacaoAdmin ?? null)
                : null,
        },
      })
      de = para
    }
  }

  const total = await prisma.reserva.count()

  console.log(`\n  ${total} reservas de exemplo criadas.`)
  console.log(`  Datas usadas: ${D.d1}, ${D.d2}, ${D.d3} e ${D.passado} (passada).\n`)
  console.log('  ── Acesso ao painel (/admin) ──')
  console.log(`  usuário: ${usuario}`)

  if (senhaDoEnv) {
    console.log('  senha:   (a definida em ADMIN_SENHA no .env)')
  } else {
    console.log(`  senha:   ${senha}`)
    console.log('\n  Anote a senha: ela foi gerada aleatoriamente e não fica salva em texto.')
    console.log('  Para escolher a sua, defina ADMIN_SENHA no .env e rode o seed de novo.')
  }
  console.log('')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
