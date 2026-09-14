import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  dataValida,
  diaDaSemana,
  duracaoEmMinutos,
  ehDiaUtil,
  formatarData,
  horaValida,
  idade,
  somaDiasUteis,
} from '../src/lib/datas'
import { primeiraDataValida, validarAntecedencia } from '../src/lib/regras/antecedencia'
import { validarDuracao } from '../src/lib/regras/duracao'
import { podeTransicionar } from '../src/lib/dominio'
import { reservaSchema } from '../src/lib/schemas'

// Datas de referência fixas para os testes não dependerem de quando rodam.
// 2026-09-02 é uma quarta-feira; 2026-09-04, uma sexta.
const QUARTA = '2026-09-02'
const SEXTA = '2026-09-04'
const SABADO = '2026-09-05'

describe('datas', () => {
  it('reconhece o dia da semana sem deslocar por fuso horário', () => {
    // O bug clássico seria esta data virar 01/09 (terça) ao passar por um
    // Date local em fuso negativo.
    assert.equal(diaDaSemana(QUARTA), 3)
    assert.equal(diaDaSemana(SABADO), 6)
  })

  it('rejeita datas que não existem no calendário', () => {
    assert.equal(dataValida('2026-02-30'), false)
    assert.equal(dataValida('2026-13-01'), false)
    assert.equal(dataValida('02/09/2026'), false)
    assert.equal(dataValida('2026-09-02'), true)
  })

  it('valida horários', () => {
    assert.equal(horaValida('24:00'), false)
    assert.equal(horaValida('9:00'), false)
    assert.equal(horaValida('23:59'), true)
  })

  it('só considera segunda a sexta como dia útil', () => {
    assert.equal(ehDiaUtil(SEXTA), true)
    assert.equal(ehDiaUtil(SABADO), false)
    assert.equal(ehDiaUtil('2026-09-06'), false) // domingo
  })

  it('formata para exibição no padrão brasileiro', () => {
    assert.equal(formatarData('2026-09-02'), '02/09/2026')
  })

  it('calcula idade considerando se o aniversário já passou', () => {
    assert.equal(idade('1990-01-01', '2026-09-02'), 36)
    assert.equal(idade('1990-12-31', '2026-09-02'), 35)
    // Exatamente no dia do aniversário já conta o ano.
    assert.equal(idade('1990-09-02', '2026-09-02'), 36)
  })
})

describe('antecedência de 3 dias úteis', () => {
  it('pula o fim de semana', () => {
    // Sexta 04/09 + 3 dias úteis = seg 07, ter 08, qua 09.
    assert.equal(somaDiasUteis(SEXTA, 3), '2026-09-09')
  })

  it('não conta o próprio dia do envio', () => {
    // Quarta 02/09 + 3 = qui 03, sex 04, seg 07.
    assert.equal(primeiraDataValida(QUARTA), '2026-09-07')
  })

  it('parte do próximo dia útil quando o envio cai no fim de semana', () => {
    // Sábado 05/09 -> seg 07, ter 08, qua 09.
    assert.equal(primeiraDataValida(SABADO), '2026-09-09')
  })

  it('bloqueia data anterior ao mínimo e aceita a partir dele', () => {
    assert.equal(validarAntecedencia('2026-09-06', QUARTA).ok, false)
    assert.equal(validarAntecedencia('2026-09-07', QUARTA).ok, true)
    assert.equal(validarAntecedencia('2026-10-01', QUARTA).ok, true)
  })

  it('explica a data mínima na mensagem de erro', () => {
    const r = validarAntecedencia('2026-09-03', QUARTA)
    assert.equal(r.ok, false)
    assert.match(r.ok === false ? r.mensagem : '', /07\/09\/2026/)
  })
})

describe('duração máxima de 2 horas', () => {
  it('aceita exatamente 2 horas', () => {
    assert.equal(validarDuracao('19:00', '21:00').ok, true)
  })

  it('rejeita 2h01', () => {
    assert.equal(validarDuracao('19:00', '21:01').ok, false)
  })

  it('rejeita término anterior ou igual ao início', () => {
    assert.equal(validarDuracao('19:00', '19:00').ok, false)
    assert.equal(validarDuracao('21:00', '19:00').ok, false)
  })

  it('calcula a duração em minutos', () => {
    assert.equal(duracaoEmMinutos('08:30', '10:00'), 90)
  })
})

describe('transições de status', () => {
  it('permite o caminho normal do processo', () => {
    assert.equal(podeTransicionar('PENDENTE', 'APROVADO'), true)
    assert.equal(podeTransicionar('APROVADO', 'CONFIRMADO'), true)
    assert.equal(podeTransicionar('CONFIRMADO', 'CANCELADO'), true)
  })

  it('bloqueia estados finais', () => {
    assert.equal(podeTransicionar('REJEITADO', 'APROVADO'), false)
    assert.equal(podeTransicionar('CANCELADO', 'CONFIRMADO'), false)
  })

  it('não deixa confirmar sem aprovar antes', () => {
    assert.equal(podeTransicionar('PENDENTE', 'CONFIRMADO'), false)
  })
})

describe('schema do formulário', () => {
  const base = {
    nomeSolicitante: 'Marcos Vinícius Teixeira',
    dataNascimento: '1992-04-15',
    telefone: '(11) 98888-7777',
    email: '  Marcos@Exemplo.COM  ',
    tipoVinculo: 'LIDER_MINISTERIO',
    codigoMembresia: '',
    espaco: 'QUADRA_SOCIETY',
    data: '2026-09-07',
    horaInicio: '19:00',
    horaFim: '21:00',
    finalidade: 'Treino do time de futebol do ministério de homens.',
    ciencia1: true,
    ciencia2: true,
    ciencia3: true,
    ciencia4: true,
    ciencia5: true,
  }

  it('normaliza telefone e e-mail', () => {
    const r = reservaSchema.safeParse(base)
    assert.equal(r.success, true)
    assert.equal(r.data!.telefone, '11988887777')
    assert.equal(r.data!.email, 'marcos@exemplo.com')
  })

  it('exige as cinco confirmações de ciência', () => {
    for (let i = 1; i <= 5; i++) {
      const r = reservaSchema.safeParse({ ...base, [`ciencia${i}`]: false })
      assert.equal(r.success, false, `ciencia${i} deveria ser obrigatória`)
    }
  })

  it('exige código de membresia apenas para membros', () => {
    const semCodigo = reservaSchema.safeParse({ ...base, tipoVinculo: 'MEMBRO' })
    assert.equal(semCodigo.success, false)

    const comCodigo = reservaSchema.safeParse({
      ...base,
      tipoVinculo: 'MEMBRO',
      codigoMembresia: '48213',
    })
    assert.equal(comCodigo.success, true)

    // Não membro segue válido sem código.
    const naoMembro = reservaSchema.safeParse({ ...base, tipoVinculo: 'NAO_MEMBRO' })
    assert.equal(naoMembro.success, true)
  })

  it('exige nome e sobrenome', () => {
    assert.equal(reservaSchema.safeParse({ ...base, nomeSolicitante: 'Marcos' }).success, false)
  })

  it('rejeita telefone sem DDD', () => {
    assert.equal(reservaSchema.safeParse({ ...base, telefone: '988887777' }).success, false)
  })

  it('rejeita término anterior ao início', () => {
    const r = reservaSchema.safeParse({ ...base, horaInicio: '21:00', horaFim: '19:00' })
    assert.equal(r.success, false)
    assert.equal(r.error!.issues.some((i) => i.path[0] === 'horaFim'), true)
  })
})
