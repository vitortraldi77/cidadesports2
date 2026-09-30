-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "googleCalendarId" TEXT,
ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "origem" TEXT NOT NULL DEFAULT 'FORMULARIO',
ALTER COLUMN "dataNascimento" DROP NOT NULL,
ALTER COLUMN "telefone" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "tipoVinculo" DROP NOT NULL,
ALTER COLUMN "finalidade" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AgendaFixa" ADD COLUMN     "googleCalendarId" TEXT,
ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "origem" TEXT NOT NULL DEFAULT 'PAINEL';

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_googleCalendarId_googleEventId_espaco_key" ON "Reserva"("googleCalendarId", "googleEventId", "espaco");

-- CreateIndex
CREATE UNIQUE INDEX "AgendaFixa_googleCalendarId_googleEventId_espaco_diaSemana_key" ON "AgendaFixa"("googleCalendarId", "googleEventId", "espaco", "diaSemana");

