import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { distribuirEmFaixas, faixaDeHoras } from '../src/lib/calendario'
import { diaCurto, diasDaSemana, inicioDaSemana } from '../src/lib/datas'

const r = (horaInicio: string, horaFim: string, id = `${horaInicio}-${horaFim}`) => ({
  horaInicio,
  horaFim,
  id,
})

describe('semana', () => {
  it('começa na segunda-feira', () => {
    // 2026-09-02 é quarta; 2026-09-07 é segunda.
    assert.equal(inicioDaSemana('2026-09-02'), '2026-08-31')
    assert.equal(inicioDaSemana('2026-09-07'), '2026-09-07')
  })

  it('trata domingo como fim da semana, não como começo', () => {
    // 2026-09-06 é domingo: pertence à semana que começou em 31/08.
    assert.equal(inicioDaSemana('2026-09-06'), '2026-08-31')
  })

  it('devolve sete dias em ordem, de segunda a domingo', () => {
    const dias = diasDaSemana('2026-09-09')
    assert.equal(dias.length, 7)
    assert.equal(dias[0], '2026-09-07')
    assert.equal(dias[6], '2026-09-13')
    assert.deepEqual(dias.map(diaCurto), ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'])
  })

  it('atravessa a virada de mês', () => {
    assert.equal(diasDaSemana('2026-10-01')[0], '2026-09-28')
  })
})

describe('distribuição em faixas', () => {
  it('deixa reservas sem sobreposição na largura inteira', () => {
    const f = distribuirEmFaixas([r('08:00', '10:00'), r('14:00', '16:00')])
    assert.deepEqual(
      f.map((x) => [x.faixa, x.faixas]),
      [
        [0, 1],
        [0, 1],
      ],
    )
  })

  it('coloca duas reservas simultâneas lado a lado', () => {
    const f = distribuirEmFaixas([r('19:00', '21:00'), r('19:00', '20:00')])
    assert.deepEqual(
      f.map((x) => [x.faixa, x.faixas]),
      [
        [0, 2],
        [1, 2],
      ],
    )
  })

  it('trata reservas encostadas como não sobrepostas', () => {
    // 19–21 e 21–23 dividem só o instante final: cada uma fica inteira.
    const f = distribuirEmFaixas([r('19:00', '21:00'), r('21:00', '23:00')])
    assert.deepEqual(
      f.map((x) => [x.faixa, x.faixas]),
      [
        [0, 1],
        [0, 1],
      ],
    )
  })

  it('reaproveita a faixa livre depois que a reserva anterior termina', () => {
    // A e B se sobrepõem; C começa quando A termina e cabe na faixa de A.
    const f = distribuirEmFaixas([
      r('08:00', '10:00', 'A'),
      r('09:00', '12:00', 'B'),
      r('10:00', '11:00', 'C'),
    ])
    const por = Object.fromEntries(f.map((x) => [x.item.id, x]))
    assert.equal(por.A.faixa, 0)
    assert.equal(por.B.faixa, 1)
    assert.equal(por.C.faixa, 0)
    // Todas encadeadas pelo B: um único grupo de 2 faixas.
    assert.deepEqual([por.A.faixas, por.B.faixas, por.C.faixas], [2, 2, 2])
  })

  it('não estreita o dia inteiro por causa de uma sobreposição isolada', () => {
    // Duas simultâneas de manhã; uma sozinha à tarde deve ficar inteira.
    const f = distribuirEmFaixas([
      r('08:00', '10:00', 'manha1'),
      r('08:30', '10:00', 'manha2'),
      r('15:00', '17:00', 'tarde'),
    ])
    const por = Object.fromEntries(f.map((x) => [x.item.id, x]))
    assert.equal(por.manha1.faixas, 2)
    assert.equal(por.manha2.faixas, 2)
    assert.equal(por.tarde.faixas, 1, 'a reserva da tarde deveria ocupar a largura toda')
  })

  it('acomoda os três espaços no mesmo horário', () => {
    const f = distribuirEmFaixas([
      r('19:00', '21:00', 'a'),
      r('19:00', '21:00', 'b'),
      r('19:00', '21:00', 'c'),
    ])
    assert.deepEqual(f.map((x) => x.faixa).sort(), [0, 1, 2])
    assert.equal(new Set(f.map((x) => x.faixas)).size, 1)
    assert.equal(f[0].faixas, 3)
  })

  it('converte os horários para minutos', () => {
    const [f] = distribuirEmFaixas([r('08:30', '10:00')])
    assert.equal(f.inicio, 510)
    assert.equal(f.fim, 600)
  })

  it('não altera o array recebido', () => {
    const entrada = [r('14:00', '16:00'), r('08:00', '10:00')]
    distribuirEmFaixas(entrada)
    assert.equal(entrada[0].horaInicio, '14:00')
  })
})

describe('faixa de horas da grade', () => {
  it('usa o horário base quando a semana está vazia', () => {
    assert.deepEqual(faixaDeHoras([]), { de: 7, ate: 23 })
  })

  it('não encolhe além do base', () => {
    assert.deepEqual(faixaDeHoras([r('10:00', '12:00')]), { de: 7, ate: 23 })
  })

  it('expande para caber reserva antes do horário base', () => {
    assert.equal(faixaDeHoras([r('06:00', '08:00')]).de, 6)
  })

  it('arredonda o fim para cima para a linha da hora aparecer', () => {
    assert.equal(faixaDeHoras([r('21:00', '23:30')]).ate, 24)
  })
})
