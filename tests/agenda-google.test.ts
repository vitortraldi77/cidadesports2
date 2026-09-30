import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  encerrarRegra,
  eventoDaAgendaFixa,
  eventoDaReserva,
  formatarTelefone,
  idEventoAgendaFixa,
  idEventoReserva,
  idEventoValido,
  primeiraOcorrencia,
} from '../src/lib/agenda-google/eventos'
import { diaDaSemana } from '../src/lib/datas'

// 2026-10-06 é uma terça-feira; 2026-10-07, uma quarta.
const TERCA = '2026-10-06'
const QUARTA = '2026-10-07'

const reserva = {
  id: 123,
  status: 'CONFIRMADO',
  espaco: 'QUADRA_SOCIETY',
  data: TERCA,
  horaInicio: '19:00',
  horaFim: '21:00',
  nomeSolicitante: 'Fulano de Tal',
  telefone: '11987654321',
  email: 'fulano@exemplo.com',
  tipoVinculo: 'MEMBRO',
  finalidade: 'Jogo da célula.',
}

const agenda = {
  id: 7,
  titulo: 'Jiu Jitsu',
  responsavel: 'Prof. Carlos',
  espaco: 'CAMPO_FUTEBOL',
  diaSemana: 2, // terça
  horaInicio: '19:00',
  horaFim: '20:30',
  dataInicio: QUARTA, // começa numa quarta: a 1ª terça é a da semana seguinte
  dataFim: null,
  ativa: true,
}

describe('ids de evento do Google', () => {
  it('usam só o alfabeto base32hex que o Google aceita', () => {
    // Um "x" ou "w" no prefixo faria o Google recusar a criação com 400.
    assert.ok(idEventoValido(idEventoReserva(1)))
    assert.ok(idEventoValido(idEventoReserva(999999)))
    assert.ok(idEventoValido(idEventoAgendaFixa(1)))
    assert.ok(!idEventoValido('csagendafixa1'))
  })

  it('são estáveis: a mesma reserva gera sempre o mesmo id', () => {
    assert.equal(idEventoReserva(123), idEventoReserva(123))
    assert.notEqual(idEventoReserva(1), idEventoAgendaFixa(1))
  })
})

describe('evento de reserva', () => {
  it('manda data e hora de parede com o fuso, sem converter para UTC', () => {
    // O bug a evitar: 19:00 em São Paulo virar 22:00 (UTC) ou o dia andar.
    const e = eventoDaReserva(reserva)
    assert.deepEqual(e.start, { dateTime: '2026-10-06T19:00:00', timeZone: 'America/Sao_Paulo' })
    assert.deepEqual(e.end, { dateTime: '2026-10-06T21:00:00', timeZone: 'America/Sao_Paulo' })
  })

  it('segue o padrão de título que já existia na agenda', () => {
    assert.equal(eventoDaReserva(reserva).summary, 'RESERVA SOCIETY – Fulano de Tal')
  })

  it('marca "a confirmar" no fim do título enquanto está só aprovada', () => {
    const e = eventoDaReserva({ ...reserva, status: 'APROVADO' })
    assert.equal(e.summary, 'RESERVA SOCIETY – Fulano de Tal (a confirmar)')
  })

  it('leva protocolo, contato e finalidade na descrição', () => {
    const d = eventoDaReserva(reserva).description
    assert.match(d, /CS-000123/)
    assert.match(d, /\(11\) 98765-4321/)
    assert.match(d, /Membro da Igreja da Cidade/)
    assert.match(d, /Jogo da célula\./)
  })

  it('reserva importada, sem contato, não mostra linhas vazias', () => {
    const d = eventoDaReserva({
      ...reserva,
      email: null,
      tipoVinculo: null,
      finalidade: null,
      telefone: null,
    }).description
    assert.doesNotMatch(d, /null|E-mail|Vínculo|Finalidade|Telefone/)
    assert.match(d, /Responsável: Fulano de Tal/)
  })

  it('cobre os espaços novos com o nome usado na agenda', () => {
    assert.equal(
      eventoDaReserva({ ...reserva, espaco: 'QUADRA_COBERTA' }).summary,
      'RESERVA QUADRA COBERTA – Fulano de Tal',
    )
    assert.equal(
      eventoDaReserva({ ...reserva, espaco: 'ESPACO_IGNICAO' }).location,
      'Espaço Ignição',
    )
  })

  it('se identifica como evento do sistema', () => {
    const p = eventoDaReserva(reserva).extendedProperties.private
    assert.equal(p.origem, 'cidadesports')
    assert.equal(p.reservaId, '123')
  })
})

describe('evento de agenda fixa', () => {
  it('começa na primeira ocorrência real, não na data de início', () => {
    // DTSTART numa quarta com BYDAY=TU criaria uma ocorrência fantasma na quarta.
    assert.equal(primeiraOcorrencia(QUARTA, 2), '2026-10-13')
    assert.equal(primeiraOcorrencia(TERCA, 2), TERCA)
    assert.equal(diaDaSemana(primeiraOcorrencia('2026-10-01', 0)), 0)

    const e = eventoDaAgendaFixa(agenda, '2026-10-01')!
    assert.equal(e.start.dateTime, '2026-10-13T19:00:00')
    assert.equal(e.end.dateTime, '2026-10-13T20:30:00')
  })

  it('sem data de término, repete para sempre', () => {
    const e = eventoDaAgendaFixa(agenda, '2026-10-01')!
    assert.deepEqual(e.recurrence, ['RRULE:FREQ=WEEKLY;BYDAY=TU'])
  })

  it('com data de término, o último dia inteiro entra na série', () => {
    // 23:59:59 de 15/12 em São Paulo = 02:59:59Z de 16/12. Um UNTIL em
    // 15/12T23:59:59Z cortaria qualquer ocorrência depois das 20:59 locais.
    const e = eventoDaAgendaFixa({ ...agenda, dataFim: '2026-12-15' }, '2026-10-01')!
    assert.deepEqual(e.recurrence, ['RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20261216T025959Z'])
  })

  it('desativada, encerra a série ontem e preserva o passado', () => {
    const e = eventoDaAgendaFixa({ ...agenda, ativa: false }, '2026-11-10')!
    assert.deepEqual(e.recurrence, ['RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20261110T025959Z'])
  })

  it('desativada com término anterior a ontem, mantém o término original', () => {
    const e = eventoDaAgendaFixa({ ...agenda, ativa: false, dataFim: '2026-10-20' }, '2026-11-10')!
    assert.deepEqual(e.recurrence, ['RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20261021T025959Z'])
  })

  it('desativada antes da primeira ocorrência, não sobra evento', () => {
    assert.equal(eventoDaAgendaFixa({ ...agenda, ativa: false }, '2026-10-08'), null)
  })

  it('término antes da primeira ocorrência, não sobra evento', () => {
    // Começa numa quarta e termina na segunda seguinte: nenhuma terça no meio.
    assert.equal(eventoDaAgendaFixa({ ...agenda, dataFim: '2026-10-12' }, '2026-10-01'), null)
  })
})

describe('encerrar série importada', () => {
  it('troca só o fim e preserva vários dias da semana', () => {
    // O Colégio Inspire é UMA série de segunda a sexta: encerrar não pode
    // reduzi-la a um dia só.
    assert.deepEqual(
      encerrarRegra(['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'], '2026-11-09'),
      ['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261110T025959Z'],
    )
  })

  it('substitui UNTIL ou COUNT que já existam', () => {
    assert.deepEqual(
      encerrarRegra(['RRULE:FREQ=WEEKLY;UNTIL=20271231T000000Z;BYDAY=SA'], '2026-11-09'),
      ['RRULE:FREQ=WEEKLY;BYDAY=SA;UNTIL=20261110T025959Z'],
    )
    assert.deepEqual(
      encerrarRegra(['RRULE:FREQ=WEEKLY;COUNT=40;BYDAY=SU'], '2026-11-09'),
      ['RRULE:FREQ=WEEKLY;BYDAY=SU;UNTIL=20261110T025959Z'],
    )
  })

  it('não mexe em exceções da série', () => {
    const r = encerrarRegra(['EXDATE;TZID=America/Sao_Paulo:20261012T060000', 'RRULE:FREQ=WEEKLY'], '2026-11-09')
    assert.equal(r[0], 'EXDATE;TZID=America/Sao_Paulo:20261012T060000')
  })

  it('evento de dia inteiro usa UNTIL só com data', () => {
    assert.deepEqual(encerrarRegra(['RRULE:FREQ=DAILY'], '2026-11-09', true), [
      'RRULE:FREQ=DAILY;UNTIL=20261109',
    ])
  })
})

describe('formatarTelefone', () => {
  it('formata celular e fixo com DDD', () => {
    assert.equal(formatarTelefone('11987654321'), '(11) 98765-4321')
    assert.equal(formatarTelefone('1133334444'), '(11) 3333-4444')
  })

  it('deixa passar o que não reconhece', () => {
    assert.equal(formatarTelefone('123'), '123')
  })
})
