import { z } from 'zod'
import { DIAS_SEMANA, ESPACOS, TIPOS_VINCULO, VINCULO_EXIGE_MEMBRESIA } from './dominio'
import { dataValida, horaValida, paraMinutos } from './datas'

/** Remove tudo que não é dígito do telefone. */
export function apenasDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

const CIENCIA = 'Você precisa marcar todas as confirmações de ciência para enviar.'

/**
 * Schema do formulário público.
 *
 * Cobre apenas o que dá para validar olhando o próprio formulário: formato,
 * obrigatoriedade e coerência entre campos. As regras que dependem do banco
 * (conflito de horário e limite por responsável) ficam em lib/regras/, porque
 * precisam consultar as outras reservas.
 */
export const reservaSchema = z
  .object({
    nomeSolicitante: z
      .string()
      .trim()
      .min(3, 'Informe o nome completo.')
      .max(120, 'Nome muito longo.')
      .refine((v) => v.includes(' '), 'Informe o nome e o sobrenome.'),

    dataNascimento: z
      .string()
      .refine(dataValida, 'Data de nascimento inválida.'),

    telefone: z
      .string()
      .transform(apenasDigitos)
      .refine(
        (v) => v.length === 10 || v.length === 11,
        'Informe o telefone com DDD (10 ou 11 dígitos).',
      ),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email('E-mail inválido.')),

    tipoVinculo: z.enum(
      Object.keys(TIPOS_VINCULO) as [string, ...string[]],
      'Selecione o seu tipo de vínculo.',
    ),

    codigoMembresia: z.string().trim().max(40).optional().or(z.literal('')),

    espaco: z.enum(
      Object.keys(ESPACOS) as [string, ...string[]],
      'Selecione o espaço desejado.',
    ),

    data: z.string().refine(dataValida, 'Data da reserva inválida.'),
    horaInicio: z.string().refine(horaValida, 'Horário de início inválido.'),
    horaFim: z.string().refine(horaValida, 'Horário de término inválido.'),

    finalidade: z
      .string()
      .trim()
      .min(10, 'Descreva a finalidade com pelo menos 10 caracteres.')
      .max(1000, 'Descrição muito longa.'),

    // Confirmações de ciência — todas obrigatórias.
    ciencia1: z.literal(true, CIENCIA),
    ciencia2: z.literal(true, CIENCIA),
    ciencia3: z.literal(true, CIENCIA),
    ciencia4: z.literal(true, CIENCIA),
    ciencia5: z.literal(true, CIENCIA),
  })
  .superRefine((v, ctx) => {
    // Código de membresia só é exigido — e só é guardado — para membros.
    if (v.tipoVinculo === VINCULO_EXIGE_MEMBRESIA && !v.codigoMembresia?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['codigoMembresia'],
        message: 'Informe o seu código de membresia.',
      })
    }

    if (horaValida(v.horaInicio) && horaValida(v.horaFim)) {
      if (paraMinutos(v.horaFim) <= paraMinutos(v.horaInicio)) {
        ctx.addIssue({
          code: 'custom',
          path: ['horaFim'],
          message: 'O horário de término deve ser depois do horário de início.',
        })
      }
    }
  })

export type ReservaInput = z.input<typeof reservaSchema>
export type ReservaValidada = z.output<typeof reservaSchema>

export const loginSchema = z.object({
  usuario: z.string().trim().min(1, 'Informe o usuário.'),
  senha: z.string().min(1, 'Informe a senha.'),
})

/**
 * Schema da agenda fixa, criada pelo Vitor direto no painel.
 *
 * Bem mais enxuto que o do formulário público: não há solicitante para
 * validar, e quem cria já é a autoridade que decide.
 */
export const agendaFixaSchema = z
  .object({
    titulo: z.string().trim().min(3, 'Descreva o compromisso.').max(120, 'Título muito longo.'),
    responsavel: z
      .string()
      .trim()
      .min(2, 'Informe quem é o responsável.')
      .max(120, 'Nome muito longo.'),

    espaco: z.enum(Object.keys(ESPACOS) as [string, ...string[]], 'Selecione o espaço.'),

    diaSemana: z.coerce.number().int().min(0).max(6, {
      message: 'Selecione o dia da semana.',
    }),
    horaInicio: z.string().refine(horaValida, 'Horário de início inválido.'),
    horaFim: z.string().refine(horaValida, 'Horário de término inválido.'),

    dataInicio: z.string().refine(dataValida, 'Data de início inválida.'),
    // Vazio = sem data de término; refletido como null antes de salvar.
    dataFim: z.string().refine((v) => v === '' || dataValida(v), 'Data de término inválida.'),
  })
  .refine((v) => v.diaSemana in DIAS_SEMANA, { message: 'Selecione o dia da semana.', path: ['diaSemana'] })
  .superRefine((v, ctx) => {
    if (horaValida(v.horaInicio) && horaValida(v.horaFim)) {
      if (paraMinutos(v.horaFim) <= paraMinutos(v.horaInicio)) {
        ctx.addIssue({
          code: 'custom',
          path: ['horaFim'],
          message: 'O horário de término deve ser depois do horário de início.',
        })
      }
    }

    if (v.dataFim && dataValida(v.dataInicio) && dataValida(v.dataFim) && v.dataFim < v.dataInicio) {
      ctx.addIssue({
        code: 'custom',
        path: ['dataFim'],
        message: 'A data de término não pode ser antes da data de início.',
      })
    }
  })

export type AgendaFixaValidada = z.output<typeof agendaFixaSchema>
